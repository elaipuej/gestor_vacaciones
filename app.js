const SUPABASE_URL = "https://wrxtjjsuzdnatghailxv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SP4oKc9aqA1u5TH8Yl4zoA_6kSDBZbG";

const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_ANON_KEY.includes("PEGA_AQUI");
const rememberKey = "gestor-vacaciones-remember-session";
const authStorage = {
  getItem(key){return localStorage.getItem(key)??sessionStorage.getItem(key);},
  setItem(key,value){
    const remember=document.getElementById("remember-session")?.checked??false;
    const destination=remember?localStorage:sessionStorage;
    destination.setItem(key,value);
    (remember?sessionStorage:localStorage).removeItem(key);
  },
  removeItem(key){localStorage.removeItem(key);sessionStorage.removeItem(key);}
};
const rememberInput=document.getElementById("remember-session");
if(rememberInput)rememberInput.checked=localStorage.getItem(rememberKey)==="true";
const db = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {auth:{storage:authStorage}}) : null;
const $ = (id) => document.getElementById(id);
const state = { user:null, profile:null, profiles:[], loginProfiles:[], requests:[], holidays:[], view:"dashboard", mode:"month", period:new Date(), selectedYear:new Date().getFullYear() };
const monthNames = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const fmt = (s) => { if(!s) return "—"; const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d).toLocaleDateString("es-ES",{day:"2-digit",month:"short",year:"numeric"}); };
const fmtTimestamp = (s) => s ? new Date(s).toLocaleString("es-ES",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—";
const dateObj = (s) => { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const daysBetween = (a,b) => Math.round((dateObj(b)-dateObj(a))/86400000)+1;
const initials = (s) => (s||"U").trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();
const isAdmin = () => state.profile?.role === "admin";
const profileName = (id) => state.profiles.find(p=>p.id===id)?.full_name || "Trabajador";
const statusText = (s) => ({pending:"Pendiente",approved:"Aprobada",rejected:"Rechazada"}[s]||s);
const escapeHtml = (s) => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function toast(msg){$("toast").textContent=msg;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2600);}
function setMessage(id,msg){$(id).textContent=msg||"";}
function showLogin(){ $("login-screen").classList.remove("hidden");$("app").classList.add("hidden"); }
function showApp(){ $("login-screen").classList.add("hidden");$("app").classList.remove("hidden"); }

async function authSubmit(e){
  e.preventDefault(); if(!db)return;
  setMessage("auth-message","");
  const selected=state.loginProfiles.find(profile=>profile.id===$("login-user").value);
  if(!selected){setMessage("auth-message","Selecciona un usuario de la lista.");return;}
  const password=$("password").value;
  const {error}=await db.auth.signInWithPassword({email:selected.email,password});
  if(error)setMessage("auth-message",error.message);
}
async function loadLoginProfiles(){
  const select=$("login-user"),retry=$("retry-users");
  $("login-btn").disabled=true;
  select.innerHTML=`<option value="">Cargando usuarios...</option>`;
  retry.classList.add("hidden");
  setMessage("auth-message","");
  let timeoutId;
  try{
    const result=await Promise.race([
      db.rpc("list_login_profiles"),
      new Promise((_,reject)=>{timeoutId=setTimeout(()=>reject(new Error("Supabase no respondió en 12 segundos.")),12000);})
    ]);
    if(result.error)throw new Error(result.error.message);
    state.loginProfiles=result.data||[];
    select.innerHTML=state.loginProfiles.length
      ? `<option value="">Selecciona tu usuario</option>${state.loginProfiles.map(profile=>`<option value="${profile.id}">${escapeHtml(profile.full_name||"Usuario")}</option>`).join("")}`
      : `<option value="">No hay usuarios registrados</option>`;
    $("login-btn").disabled=!state.loginProfiles.length;
    if(!state.loginProfiles.length)setMessage("auth-message","No hay usuarios creados en Supabase.");
  }catch(error){
    state.loginProfiles=[];
    select.innerHTML=`<option value="">No se pudieron cargar los usuarios</option>`;
    setMessage("auth-message",`Error al cargar usuarios: ${error.message}`);
    retry.classList.remove("hidden");
  }finally{
    clearTimeout(timeoutId);
  }
}
async function logout(){await db.auth.signOut();state.user=null;state.profile=null;showLogin();}
async function loadData(){
  const [p,r,h]=await Promise.all([
    db.from("profiles").select("id,full_name,role,annual_days,created_at").order("full_name"),
    db.from("vacation_requests").select("*").order("created_at",{ascending:false}),
    db.from("holidays").select("*").order("date")
  ]);
  if(p.error||r.error||h.error){toast((p.error||r.error||h.error).message);return;}
  state.profiles=p.data||[];state.requests=r.data||[];state.holidays=h.data||[];
  state.profile=state.profiles.find(x=>x.id===state.user.id);
  if(!state.profile){toast("No se ha encontrado tu perfil. Contacta con el administrador.");return;}
  renderAll();
}
function initUser(){
  $("user-name").textContent=state.profile.full_name||state.user.email;
  $("user-role").textContent=isAdmin()?"Administrador":"Trabajador";
  $("user-avatar").textContent=initials(state.profile.full_name);
  $("top-user").textContent=state.profile.full_name||state.user.email;
  $("welcome-title").textContent=`Hola, ${(state.profile.full_name||"").split(" ")[0]}`;
  document.querySelectorAll(".admin-only").forEach(el=>el.classList.toggle("hidden",!isAdmin()));
  $("request-worker-label").classList.toggle("hidden",!isAdmin());
  $("request-worker").innerHTML=state.profiles.map(p=>`<option value="${p.id}">${escapeHtml(p.full_name)}</option>`).join("");
}
function myRequests(){return state.requests.filter(r=>r.user_id===state.user.id);}
function daysUsed(id,year=new Date().getFullYear()){
  return state.requests.filter(r=>r.user_id===id&&r.status==="approved"&&r.start_date.slice(0,4)==String(year)).reduce((n,r)=>n+daysBetween(r.start_date,r.end_date),0);
}
function renderAll(){initUser();renderDashboard();renderCalendar();renderRequests();renderEmployees();renderHolidays();renderReports();updatePendingBadge();}
function updatePendingBadge(){const n=state.requests.filter(r=>r.status==="pending"&&(isAdmin()||r.user_id===state.user.id)).length;$("pending-badge").textContent=n;$("pending-badge").classList.toggle("hidden",!n);}
function renderDashboard(){
  const year=new Date().getFullYear(), approved=state.requests.filter(r=>r.status==="approved"&&r.start_date.startsWith(String(year)));
  const pending=state.requests.filter(r=>r.status==="pending"&&(isAdmin()||r.user_id===state.user.id));
  const remaining=(state.profile.annual_days||30)-daysUsed(state.user.id,year);
  $("stat-employees").textContent=isAdmin()?state.profiles.length:"—";
  $("stat-approved").textContent=approved.reduce((n,r)=>n+daysBetween(r.start_date,r.end_date),0);
  $("stat-pending").textContent=pending.length;
  $("stat-remaining").textContent=remaining;
  $("remaining-caption").textContent=`De ${(state.profile.annual_days??30)} días naturales · ${year}`;
  const upcoming=state.requests.filter(r=>r.status==="approved"&&r.end_date>=iso(new Date())).sort((a,b)=>a.start_date.localeCompare(b.start_date)).slice(0,5);
  $("upcoming-list").innerHTML=upcoming.length?upcoming.map(r=>`<div class="list-row"><div><strong>${escapeHtml(profileName(r.user_id))}</strong><small>${fmt(r.start_date)} – ${fmt(r.end_date)} · ${daysBetween(r.start_date,r.end_date)} días</small></div><span class="pill approved">Aprobada</span></div>`).join(""):`<div class="empty">No hay próximas vacaciones aprobadas.</div>`;
  const recent=state.requests.slice(0,5);
  $("activity-list").innerHTML=recent.length?recent.map(r=>`<div class="list-row"><div><strong>${escapeHtml(profileName(r.user_id))}</strong><small>${fmt(r.start_date)} – ${fmt(r.end_date)}</small></div><span class="pill ${r.status}">${statusText(r.status)}</span></div>`).join(""):`<div class="empty">Todavía no hay solicitudes.</div>`;
}
function eventsForDate(date){const s=iso(date);return {requests:state.requests.filter(r=>r.status!=="rejected"&&r.start_date<=s&&r.end_date>=s),holidays:state.holidays.filter(h=>h.date===s)};}
function renderCalendar(){
  if(state.mode==="month"){renderMonth();}else{renderYear();}
}
function renderMonth(){
  const y=state.period.getFullYear(),m=state.period.getMonth();
  $("period-label").textContent=`${monthNames[m][0].toUpperCase()+monthNames[m].slice(1)} ${y}`;
  const first=new Date(y,m,1),start=new Date(y,m,1-first.getDay()),cells=[];
  ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].forEach(x=>cells.push(`<div class="weekday">${x}</div>`));
  // Calendar starts Monday
  const offset=(first.getDay()+6)%7; const gridStart=new Date(y,m,1-offset);
  for(let i=0;i<42;i++){
    const d=new Date(gridStart);d.setDate(gridStart.getDate()+i);
    const ev=eventsForDate(d),outside=d.getMonth()!==m;
    let items=ev.holidays.map(h=>`<div class="event holiday" title="${escapeHtml(h.name)}">${escapeHtml(h.name)}</div>`);
    ev.requests.slice(0,3).forEach(r=>items.push(`<div class="event ${r.status}" title="${escapeHtml(profileName(r.user_id))}">${escapeHtml(profileName(r.user_id).split(" ")[0])}</div>`));
    cells.push(`<div class="day-cell ${outside?"outside":""}"><div class="day-number">${d.getDate()}</div><div class="day-events">${items.join("")}</div></div>`);
  }
  $("calendar-content").innerHTML=`<div class="month-grid">${cells.join("")}</div>`;
}
function renderYear(){
  const y=state.period.getFullYear();$("period-label").textContent=String(y);
  const months=monthNames.map((name,m)=>{
    const first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),offset=(first.getDay()+6)%7,arr=[];
    ["L","M","X","J","V","S","D"].forEach(x=>arr.push(`<span>${x}</span>`));
    for(let i=0;i<offset;i++)arr.push("<span></span>");
    for(let d=1;d<=days;d++){const date=new Date(y,m,d),ev=eventsForDate(date);arr.push(`<span class="${ev.holidays.length?"has-holiday":ev.requests.length?"has-event":""}" title="${[...ev.holidays.map(h=>h.name),...ev.requests.map(r=>profileName(r.user_id))].join(", ")}">${d}</span>`);}
    return `<div class="mini-month"><h4>${name[0].toUpperCase()+name.slice(1)}</h4><div class="mini-days">${arr.join("")}</div></div>`;
  }).join("");
  $("calendar-content").innerHTML=`<div class="year-grid">${months}</div>`;
}
function renderRequests(){
  const filter=$("request-filter").value;
  let rows=[...state.requests];
  if(filter!=="all")rows=rows.filter(r=>r.status===filter);
  rows.sort((a,b)=>a.created_at.localeCompare(b.created_at));
  $("requests-list").innerHTML=rows.length?`<table class="data-table"><thead><tr><th>Trabajador</th><th>Solicitada</th><th>Periodo</th><th>Días</th><th>Estado</th><th>Observaciones</th><th>Comentario administrador</th><th>Acciones</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${escapeHtml(profileName(r.user_id))}</strong></td><td>${fmtTimestamp(r.created_at)}</td><td>${fmt(r.start_date)} – ${fmt(r.end_date)}</td><td>${daysBetween(r.start_date,r.end_date)}</td><td><span class="pill ${r.status}">${statusText(r.status)}</span></td><td>${escapeHtml(r.notes||"—")}</td><td>${escapeHtml(r.review_comment||"—")}</td><td>${isAdmin()&&r.status==="pending"?`<div class="table-actions"><button class="small-action approve" data-action="approve" data-id="${r.id}">Aprobar</button><button class="small-action reject" data-action="reject" data-id="${r.id}">Rechazar</button></div>`:"—"}</td></tr>`).join("")}</tbody></table>`:`<div class="empty">No hay solicitudes para mostrar.</div>`;
}
function renderEmployees(){
  if(!isAdmin())return;
  $("employees-list").innerHTML=`<table class="data-table"><thead><tr><th>Trabajador</th><th>Perfil</th><th>Días anuales</th><th>Disfrutados ${new Date().getFullYear()}</th><th>Disponibles</th><th></th></tr></thead><tbody>${state.profiles.map(p=>{const used=daysUsed(p.id);return `<tr><td><strong>${escapeHtml(p.full_name||"Sin nombre")}</strong></td><td>${p.role==="admin"?"Administrador":"Trabajador"}</td><td>${p.annual_days??30}</td><td>${used}</td><td>${(p.annual_days??30)-used}</td><td><button class="small-action edit" data-edit-days="${p.id}" data-days="${p.annual_days??30}">Editar días</button></td></tr>`}).join("")}</tbody></table>`;
}
function renderHolidays(){
  if(!isAdmin())return;
  $("holidays-list").innerHTML=state.holidays.length?`<table class="data-table"><thead><tr><th>Fecha</th><th>Festivo</th><th></th></tr></thead><tbody>${state.holidays.map(h=>`<tr><td>${fmt(h.date)}</td><td><strong>${escapeHtml(h.name)}</strong></td><td><button class="small-action reject" data-delete-holiday="${h.id}">Eliminar</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">Todavía no has añadido festivos.</div>`;
}
function renderReports(){
  const rows=state.requests;
  $("report-summary").innerHTML=`<div><strong>${rows.length}</strong><span>Solicitudes visibles</span></div><div><strong>${rows.filter(r=>r.status==="approved").length}</strong><span>Aprobadas</span></div><div><strong>${rows.filter(r=>r.status==="pending").length}</strong><span>Pendientes</span></div>`;
}
function openRequest(){
  $("request-form").reset();setMessage("request-error","");
  $("conflict-warning").classList.add("hidden");
  if(isAdmin())$("request-worker").value=state.user.id;
  $("start-date").min=iso(new Date());$("end-date").min=iso(new Date());
  $("day-preview").textContent="Selecciona las fechas para calcular los días naturales.";
  $("request-dialog").showModal();
}
function checkRequestPreview(){
  const a=$("start-date").value,b=$("end-date").value;
  if(!a||!b)return;
  if(b<a){$("day-preview").textContent="La fecha final no puede ser anterior a la inicial.";return;}
  const n=daysBetween(a,b),userId=isAdmin()?$("request-worker").value:state.user.id;
  $("day-preview").textContent=`${n} día(s) natural(es), contando inicio y fin.`;
  const conflicts=state.requests.filter(r=>r.status!=="rejected"&&r.user_id!==userId&&r.start_date<=b&&r.end_date>=a);
  const holidayCount=state.holidays.filter(h=>h.date>=a&&h.date<=b).length;
  if(conflicts.length){$("conflict-warning").textContent=`Aviso: ${conflicts.length} solicitud(es) de otros trabajadores coinciden total o parcialmente con estas fechas. La solicitud podrá enviarse, pero conviene revisar la cobertura del equipo.`;$("conflict-warning").classList.remove("hidden");}
  else $("conflict-warning").classList.add("hidden");
  if(holidayCount)$("day-preview").textContent+=` Hay ${holidayCount} festivo(s) dentro del periodo; al contar días naturales, también se incluyen.`;
}
async function submitRequest(e){
  e.preventDefault();const a=$("start-date").value,b=$("end-date").value;
  if(!a||!b||b<a){setMessage("request-error","Comprueba las fechas.");return;}
  const userId=isAdmin()?$("request-worker").value:state.user.id;
  const payload={user_id:userId,start_date:a,end_date:b,notes:$("request-notes").value.trim(),status:"pending"};
  const {error}=await db.from("vacation_requests").insert(payload);
  if(error){setMessage("request-error",error.message);return;}
  $("request-dialog").close();toast("Solicitud enviada correctamente.");await loadData();
}
function openReviewDialog(id,status){
  $("review-request-id").value=id;
  $("review-status").value=status;
  $("review-title").textContent=status==="approved"?"Aprobar solicitud":"Rechazar solicitud";
  $("review-comment").value="";
  $("review-dialog").showModal();
}
async function updateRequest(id,status,comment){
  const {error}=await db.from("vacation_requests").update({status,reviewed_at:new Date().toISOString(),review_comment:comment||null}).eq("id",id);
  if(error){toast(error.message);return false;}toast(status==="approved"?"Vacaciones aprobadas":"Solicitud rechazada");await loadData();return true;
}
async function saveReview(e){
  e.preventDefault();
  const saved=await updateRequest($("review-request-id").value,$("review-status").value,$("review-comment").value.trim());
  if(saved)$("review-dialog").close();
}
async function addHoliday(e){
  e.preventDefault();const {error}=await db.from("holidays").insert({date:$("holiday-date").value,name:$("holiday-name").value.trim()});
  if(error){toast(error.message);return;}$("holiday-form").reset();toast("Festivo añadido.");await loadData();
}
async function deleteHoliday(id){
  if(!confirm("¿Eliminar este festivo?"))return;
  const {error}=await db.from("holidays").delete().eq("id",id);
  if(error){toast(error.message);return;}toast("Festivo eliminado.");await loadData();
}
function editDays(id,value){$("days-user-id").value=id;$("days-value").value=value;$("days-dialog").showModal();}
async function saveDays(e){
  e.preventDefault();const id=$("days-user-id").value,annual_days=Number($("days-value").value);
  const {error}=await db.from("profiles").update({annual_days}).eq("id",id);
  if(error){toast(error.message);return;}$("days-dialog").close();toast("Días anuales actualizados.");await loadData();
}
function exportExcel(){
  if(!window.XLSX){toast("No se ha podido cargar el módulo Excel. Comprueba tu conexión.");return;}
  const rows=state.requests.map(r=>({"Trabajador":profileName(r.user_id),"Solicitada":fmtTimestamp(r.created_at),"Inicio":r.start_date,"Fin":r.end_date,"Días naturales":daysBetween(r.start_date,r.end_date),"Estado":statusText(r.status),"Observaciones":r.notes||"","Comentario administrador":r.review_comment||""}));
  const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Vacaciones");
  const hol=state.holidays.map(h=>({"Fecha":h.date,"Festivo":h.name}));XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(hol),"Festivos");
  XLSX.writeFile(wb,`vacaciones-${new Date().getFullYear()}.xlsx`);
}
function navigate(view){
  if(["employees","holidays"].includes(view)&&!isAdmin())return;
  state.view=view;document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));
  $(`view-${view}`).classList.add("active");document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.view===view));
  $("page-title").textContent=({dashboard:"Resumen",calendar:"Calendario",requests:"Solicitudes",employees:"Trabajadores",holidays:"Festivos",reports:"Informes"})[view];
}
function bindEvents(){
  $("auth-form").addEventListener("submit",authSubmit);$("logout-btn").addEventListener("click",logout);
  $("retry-users").addEventListener("click",loadLoginProfiles);
  $("remember-session").addEventListener("change",e=>localStorage.setItem(rememberKey,String(e.target.checked)));
  document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
  document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.goto)));
  $("quick-request").addEventListener("click",openRequest);$("new-request").addEventListener("click",openRequest);
  ["start-date","end-date","request-worker"].forEach(id=>$(id).addEventListener("change",checkRequestPreview));
  $("request-form").addEventListener("submit",submitRequest);
  $("review-form").addEventListener("submit",saveReview);
  ["close-request","cancel-request"].forEach(id=>$(id).addEventListener("click",()=>$("request-dialog").close()));
  ["close-review","cancel-review"].forEach(id=>$(id).addEventListener("click",event=>event.target.closest("dialog").close()));
  $("request-filter").addEventListener("change",renderRequests);
  document.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>{state.mode=b.dataset.mode;document.querySelectorAll("[data-mode]").forEach(x=>x.classList.toggle("selected",x===b));renderCalendar();}));
  $("prev-period").addEventListener("click",()=>{state.period.setMonth(state.period.getMonth()-(state.mode==="month"?1:12));renderCalendar();});
  $("next-period").addEventListener("click",()=>{state.period.setMonth(state.period.getMonth()+(state.mode==="month"?1:12));renderCalendar();});
  $("today-btn").addEventListener("click",()=>{state.period=new Date();renderCalendar();});
  $("holiday-form").addEventListener("submit",addHoliday);$("days-form").addEventListener("submit",saveDays);
  ["close-days","cancel-days"].forEach(id=>$(id).addEventListener("click",()=>$("days-dialog").close()));
  $("export-excel").addEventListener("click",exportExcel);
  document.addEventListener("click",e=>{
    const action=e.target.closest("[data-action]");if(action)openReviewDialog(action.dataset.id,action.dataset.action==="approve"?"approved":"rejected");
    const del=e.target.closest("[data-delete-holiday]");if(del)deleteHoliday(del.dataset.deleteHoliday);
    const edit=e.target.closest("[data-edit-days]");if(edit)editDays(edit.dataset.editDays,edit.dataset.days);
  });
}
async function boot(){
  bindEvents();
  if(!configured){$("config-warning").classList.remove("hidden");$("login-btn").disabled=true;return;}
  await loadLoginProfiles();
  const {data:{session}}=await db.auth.getSession();
  if(session){state.user=session.user;showApp();await loadData();}
  else showLogin();
  db.auth.onAuthStateChange(async(_event,session)=>{if(session){state.user=session.user;showApp();await loadData();}else{state.user=null;showLogin();}});
}
boot();