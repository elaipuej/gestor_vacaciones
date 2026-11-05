-- Gestor de Vacaciones: esquema inicial para Supabase
-- Ejecuta este archivo completo en Supabase > SQL Editor.
-- Después crea tu cuenta y promuévela a administradora con la consulta indicada en README.md.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Trabajador',
  role text not null default 'worker' check (role in ('admin','worker')),
  annual_days integer not null default 30 check (annual_days between 0 and 365),
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_full_name_lower_idx
  on public.profiles (lower(full_name));

create table if not exists public.vacation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  notes text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_comment text,
  constraint valid_date_range check (end_date >= start_date)
);

alter table public.vacation_requests
  add column if not exists review_comment text;

create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Trabajador'))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- El formulario muestra nombres, pero Supabase Auth necesita el correo para iniciar sesión.
create or replace function public.list_login_profiles()
returns table (id uuid, full_name text, email text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, u.email::text
  from public.profiles as p
  join auth.users as u on u.id = p.id
  order by p.full_name;
$$;

revoke all on function public.list_login_profiles() from public, anon, authenticated;
grant execute on function public.list_login_profiles() to anon, authenticated;

-- Compartir solo los datos necesarios para el calendario del equipo.
create or replace function public.list_calendar_requests()
returns table (user_id uuid, start_date date, end_date date, status text)
language sql
stable
security definer
set search_path = public
as $$
  select r.user_id, r.start_date, r.end_date, r.status
  from public.vacation_requests as r
  where r.status in ('pending', 'approved');
$$;

revoke all on function public.list_calendar_requests() from public, anon, authenticated;
grant execute on function public.list_calendar_requests() to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.vacation_requests enable row level security;
alter table public.holidays enable row level security;

-- Los usuarios autenticados pueden ver nombres y roles básicos para el calendario del equipo.
drop policy if exists "profiles_read_authenticated" on public.profiles;
create policy "profiles_read_authenticated" on public.profiles
for select to authenticated using (true);

-- Solo el administrador puede modificar perfiles y días anuales.
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Los trabajadores solo consultan sus solicitudes; el administrador consulta todas.
drop policy if exists "requests_read_own_or_approved_or_admin" on public.vacation_requests;
drop policy if exists "requests_read_authenticated" on public.vacation_requests;
create policy "requests_read_own_or_admin" on public.vacation_requests
for select to authenticated
using (user_id = auth.uid() or public.is_admin());

-- El trabajador puede crear solicitudes solo a su nombre. El admin puede crear en nombre de cualquiera.
drop policy if exists "requests_insert_own_or_admin" on public.vacation_requests;
create policy "requests_insert_own_or_admin" on public.vacation_requests
for insert to authenticated
with check (user_id = auth.uid() or public.is_admin());

-- Solo el administrador puede aprobar, rechazar o borrar solicitudes.
drop policy if exists "requests_update_admin" on public.vacation_requests;
create policy "requests_update_admin" on public.vacation_requests
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "requests_delete_admin" on public.vacation_requests;
create policy "requests_delete_admin" on public.vacation_requests
for delete to authenticated using (public.is_admin());

-- Todos los usuarios pueden consultar festivos; solo admin puede mantenerlos.
drop policy if exists "holidays_read_authenticated" on public.holidays;
create policy "holidays_read_authenticated" on public.holidays
for select to authenticated using (true);

drop policy if exists "holidays_insert_admin" on public.holidays;
create policy "holidays_insert_admin" on public.holidays
for insert to authenticated with check (public.is_admin());

drop policy if exists "holidays_update_admin" on public.holidays;
create policy "holidays_update_admin" on public.holidays
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "holidays_delete_admin" on public.holidays;
create policy "holidays_delete_admin" on public.holidays
for delete to authenticated using (public.is_admin());

-- Índices para acelerar calendario y consultas por trabajador.
create index if not exists vacation_requests_user_id_idx on public.vacation_requests(user_id);
create index if not exists vacation_requests_dates_idx on public.vacation_requests(start_date, end_date);
create index if not exists vacation_requests_status_idx on public.vacation_requests(status);
