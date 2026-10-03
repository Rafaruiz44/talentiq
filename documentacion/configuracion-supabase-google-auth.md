# Configuración de Supabase y Google Auth para Talentiq

Esta guía documenta el primer bloque a implementar para dejar la autenticación de reclutadores en estado real y seguro.

## 1. Crear el proyecto en Supabase

1. Crear un proyecto nuevo en Supabase.
2. Tomar la URL del proyecto y la `anon` key pública.
3. Guardarlas en `.env` usando las variables:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

No almacenar `service_role` ni secretos OAuth en variables `VITE_*`.

## 2. Habilitar Google como proveedor de autenticación

En el panel de Supabase:

1. Ir a Authentication > Providers.
2. Activar Google.
3. Ingresar `Client ID` y `Client Secret` de Google OAuth.
4. En las URLs de redirección, permitir:
   - `http://localhost:5173`
   - `http://localhost:5173/**`
   - cualquier dominio de despliegue real usado por la app

Cuando la app llama a `signInWithOAuth({ provider: 'google' })`, la redirección usa `window.location.origin`, por lo que las URLs autorizadas deben coincidir exactamente con la origin del frontend.

El cierre de sesión de Talentiq elimina la sesión de Supabase y devuelve a la pantalla de acceso. Google puede conservar su propia sesión en el navegador; al volver a pulsar `Continuar con Google`, el proveedor puede autenticar automáticamente la cuenta existente sin volver a pedir la contraseña. Este comportamiento SSO es el esperado y no significa que la sesión de Talentiq siga abierta.

## 3. Aplicar la migración del esquema privado

La migración base ya existe en `supabase/migrations/20261002203000_initial_private_recruiter_schema.sql`.

Se debe aplicar en el proyecto Supabase con un usuario con permisos suficientes para ejecutar SQL y crear:

- tablas de perfiles, posiciones, candidatos y aplicaciones
- triggers de `updated_at`
- políticas RLS por reclutador
- bucket privado `candidate-cvs`
- políticas de almacenamiento por identidad del reclutador

## 4. Reglas de seguridad a mantener

- Cada reclutador debe ver solo sus datos.
- El backend o el acceso autorizado debe validar que la sesión es la de ese reclutador antes de leer o escribir datos privados.
- El bucket de CVs debe ser privado y estar separado por `recruiter_id`.
- No usar controles visuales como mecanismo de aislamiento; el aislamiento debe existir en la base y en el storage.
- Los errores de autenticación y autorización deben mostrarse explícitamente en la UI.

## 5. Validación mínima del flujo

Con la configuración lista:

1. Ejecutar la app localmente.
2. Abrir la pantalla de autenticación.
3. Hacer click en `Continuar con Google`.
4. Confirmar que la sesión queda activa.
5. Verificar que el usuario autenticado aparece en la UI.
6. Verificar que la sesión se cierra al pulsar `Cerrar sesión`.

## 6. Siguientes pasos

Una vez validado este bloque, continuar con:

- persistencia de posiciones y requisitos
- almacenamiento y extracción de CVs
- modelos de candidatos y solicitudes
- backend para IA con Azure OpenAI
- pruebas E2E del flujo autenticado
