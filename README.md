# Gestor de Vacaciones — primera versión

Aplicación web estática para publicar en GitHub Pages, con Supabase como base de datos y autenticación.


## Diseño para móvil
La interfaz incluye navegación inferior en teléfonos, calendario compacto, controles táctiles grandes, formularios adaptados y tablas desplazables horizontalmente. En tabletas y ordenadores utiliza el menú lateral.

## Incluye
- Inicio de sesión y registro de trabajadores.
- Perfiles con rol administrador/trabajador y días naturales anuales configurables.
- Solicitudes de vacaciones con aprobación/rechazo.
- Cálculo inclusivo de días naturales (cuenta fecha inicial y final).
- Calendario mensual y anual.
- Festivos configurables.
- Aviso de coincidencias con solicitudes de otros trabajadores.
- Exportación Excel (.xlsx).

## 1. Crear el proyecto Supabase
1. Entra en https://supabase.com/ y crea un proyecto.
2. Abre **SQL Editor**.
3. Copia y ejecuta todo el contenido de `supabase.sql`.
4. En **Project Settings → API** copia la Project URL y la clave publicable (o anon key heredada).

## 2. Configurar la aplicación
Abre `app.js` y sustituye:
- `PEGA_AQUI_TU_PROJECT_URL` por la URL de tu proyecto.
- `PEGA_AQUI_TU_PUBLISHABLE_O_ANON_KEY` por la clave pública/publishable (anon).

No introduzcas nunca la `service_role` key en el navegador ni en GitHub.

## 3. Crear la cuenta administradora
1. Publica la aplicación siguiendo el paso 4.
2. Abre la web y crea tu cuenta desde **Crear cuenta de trabajador**.
3. Si Supabase exige confirmación por correo, confirma la cuenta.
4. En Supabase → Table Editor → `profiles`, localiza tu usuario y cambia `role` de `worker` a `admin`.
5. Comprueba que `annual_days` tenga el número de días que corresponda (por defecto 30).

También puedes hacerlo desde SQL Editor, sustituyendo el correo:
```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'TU_CORREO@EMPRESA.COM'
);
```

## 4. Publicar en GitHub Pages
1. Crea un repositorio nuevo, por ejemplo `gestor-vacaciones`.
2. Sube `index.html`, `styles.css`, `app.js` y `supabase.sql` (puedes subir también este README).
3. En GitHub abre **Settings → Pages**.
4. En **Build and deployment**, selecciona **Deploy from a branch**.
5. Elige la rama `main` y la carpeta `/ (root)`. Guarda.
6. Espera a que GitHub muestre la URL pública de Pages y ábrela.

## 5. Alta de trabajadores
Cada trabajador abre la URL y pulsa **Crear cuenta de trabajador**, indicando correo, contraseña y nombre.
- El perfil se crea automáticamente como `worker`.
- El administrador ajusta sus días anuales desde **Trabajadores → Editar días**.
- La cuenta debe usar un correo real si se activa la confirmación por correo.

## Reglas actuales y límites de esta versión
- Los días se cuentan como **naturales**, incluyendo inicio y fin. Sábados, domingos y festivos también cuentan.
- Los festivos se muestran en el calendario, pero no se descuentan del cómputo de días naturales.
- Los solapamientos generan un aviso informativo; no bloquean la solicitud ni la aprobación.
- La aplicación muestra solicitudes aprobadas del equipo a todos los usuarios autenticados; las solicitudes pendientes y rechazadas solo las ve el trabajador propietario y el administrador.
- Los días disfrutados se suman por año según el año de inicio de la solicitud. Si una solicitud cruza de diciembre a enero, esta primera versión atribuye todos sus días al año de inicio.
- La primera versión no envía correos ni notificaciones push.
- Configura la política de vacaciones de la empresa antes de utilizarla oficialmente. El cálculo mostrado no sustituye la revisión de convenio, contrato ni normativa aplicable.

## Privacidad y seguridad
- Supabase aplica Row Level Security (RLS) en las tablas.
- Nunca publiques claves `service_role` o contraseñas.
- Usa contraseñas robustas y limita las cuentas a trabajadores autorizados.
- Mantén copias de seguridad del proyecto Supabase.
- GitHub Pages publica el código del frontend; los datos privados permanecen en Supabase bajo las políticas RLS.

## Próximas mejoras recomendadas
- Reglas de aprobación por centro/departamento y límites simultáneos de ausencias.
- Tratamiento de solicitudes que cruzan de año.
- Importación de festivos oficiales por municipio y año.
- Auditoría de cambios y registro de quién aprobó/rechazó.
- Recuperación de contraseña y flujo de invitación de empleados.
