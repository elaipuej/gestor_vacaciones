- Todos los usuarios autenticados pueden ver todas las solicitudes del equipo, incluidas la fecha de solicitud, el estado, las observaciones y el comentario de revisión. Solo el administrador puede aprobarlas o rechazarlas; evita incluir datos sensibles en los comentarios.
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
La URL del proyecto y la clave publicable de Supabase ya están configuradas en `app.js`.
La clave publicable se utiliza en el navegador; nunca introduzcas la clave `service_role` en el frontend ni en GitHub.

En Supabase, abre **Authentication → URL Configuration** y configura:
- **Site URL** con la URL publicada de la aplicación (por ejemplo, `https://elaipuej.github.io/gestor_vacaciones/` si usas GitHub Pages).
- **Redirect URLs** con la URL publicada y, para pruebas locales, `http://localhost:3000/**`.

El enlace de confirmación vuelve a la misma dirección desde la que se creó la cuenta. Supabase solo permitirá el retorno si esa dirección está incluida en **Redirect URLs**.

## 3. Crear los usuarios
1. En Supabase abre **Authentication → Users → Add user** y crea una cuenta para cada persona, con su correo y una contraseña individual. Confirma la cuenta desde el panel si Supabase lo requiere.
2. Al crear cada cuenta se genera automáticamente un perfil. En **Table Editor → profiles**, cambia `full_name` a `Usuario1`, `Usuario2` y `Jhasmin`, según corresponda.
3. En el perfil de Jhasmin cambia `role` de `worker` a `admin`. Los demás deben conservar el rol `worker`.
4. Comprueba que `annual_days` tenga los días anuales que correspondan (por defecto 30).

El acceso de la aplicación muestra esos nombres y cada persona inicia sesión con su propia contraseña. El correo no aparece en la pantalla, pero la aplicación estática lo consulta desde una función pública de Supabase para poder iniciar sesión; por tanto, alguien con acceso a la web podría consultar esa lista de correos. Para mantener los correos privados se necesitaría un servicio backend adicional.

También puedes hacerlo desde SQL Editor, sustituyendo el correo:
```sql
update public.profiles
set role = 'admin', full_name = 'Jhasmin'
where id = (
  select id from auth.users where email = 'CORREO_DE_JHASMIN'
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
El administrador crea las cuentas autorizadas desde **Supabase → Authentication → Users → Add user**. Cada perfil nuevo aparece en el selector de acceso.
- El perfil se crea automáticamente como `worker`.
- El administrador ajusta sus días anuales desde **Trabajadores → Editar días**.
- El correo debe ser válido si se activa la confirmación por correo.

## Reglas actuales y límites de esta versión
- Los días se cuentan como **naturales**, incluyendo inicio y fin. Sábados, domingos y festivos también cuentan.
- Los festivos se muestran en el calendario, pero no se descuentan del cómputo de días naturales.
- Los solapamientos generan un aviso informativo; no bloquean la solicitud ni la aprobación.
- Todos los usuarios autenticados pueden ver todas las solicitudes del equipo, incluidas las pendientes y rechazadas, así como sus observaciones. Solo el administrador puede aprobarlas o rechazarlas; evita incluir datos sensibles en las observaciones.
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
