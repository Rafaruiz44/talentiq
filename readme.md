# Talentiq

Talentiq es una aplicación de apoyo a reclutadores para comparar requisitos de una posición con la información de un CV y revisar un puntaje, un veredicto y un desglose de fortalezas y brechas. La evaluación ayuda al análisis inicial; no reemplaza la decisión humana de selección.

## Estado del proyecto

El repositorio contiene el MVP ejecutable localmente. El alcance acordado para la entrega final amplía ese MVP con cuentas de reclutadores mediante Google, espacios privados por reclutador, posiciones y candidatos persistentes, carga masiva, solicitudes candidato–posición, historial de evaluaciones, seguimiento de etapas, preguntas de entrevista y despliegue accesible.

Esas capacidades ampliadas están planificadas y no deben considerarse implementadas solo por estar documentadas. La arquitectura objetivo, el estado actual y las decisiones pendientes se describen en [documentacion/arquitectura-y-alcance.md](documentacion/arquitectura-y-alcance.md); las historias y sus criterios de aceptación están en [documentacion/alcance-entrega-final-y-historias.md](documentacion/alcance-entrega-final-y-historias.md).

Para consultar el estado de implementación revisado y las próximas tareas, ver [PROYECTO-ACTUAL.md](PROYECTO-ACTUAL.md).

## Funcionalidades actuales del MVP

- Gestionar puestos en pantallas diferenciadas: listado en `/puestos`, creación en `/puestos/nuevo`, detalle y evaluación en `/puestos/:id`, y edición en `/puestos/:id/editar`.
- Definir el nombre del puesto, habilidades con peso individual y seniority requerido con su peso; los puestos y requisitos se guardan en Supabase.
- Desde el detalle de un puesto, cargar un CV PDF individual de hasta 5 MB y extraer su texto con PDF.js en el navegador.
- Después de un análisis exitoso, guardar el CV en el bucket privado y persistir el perfil del candidato, los metadatos y el texto extraído en Supabase.
- Ejecutar un análisis de compatibilidad y mostrar puntaje, veredicto `Apto` o `No Apto`, fortalezas y brechas.
- Cambiar entre tema claro y oscuro; la preferencia se conserva en `sessionStorage`.

El umbral actual de aprobación está fijado en 70 %. El resultado de la evaluación y las solicitudes candidato–puesto todavía no se persisten. Si Azure OpenAI no está configurado o falla, la aplicación informa el error y no devuelve una evaluación local de respaldo.

La interfaz autenticada usa un shell adaptable Modern SaaS minimalista y navegación cliente con History API, sin dependencia de routing adicional.

## Alcance acordado para la entrega final

- Registro e inicio de sesión de reclutadores con Google.
- Banco privado de CVs y posiciones por reclutador; no se comparten datos entre cuentas en esta etapa.
- Posiciones persistentes con estado `Nueva`, `Abierta`, `Cubierta` o `Cancelada`.
- Banco privado de candidatos: persistencia de datos y texto extraído, y almacenamiento del archivo original en un bucket privado.
- Carga masiva de CVs con progreso y errores por archivo.
- Solicitudes persistentes que asocian un candidato con una o varias posiciones abiertas.
- Historial de evaluaciones y etapas independientes por solicitud: `Evaluado`, `En entrevista` o `Descartado`.
- Preguntas de entrevista basadas en los requisitos, fortalezas y brechas del cruce elegido.
- Evaluación y generación de preguntas de Azure OpenAI desde un backend, sin claves secretas en el frontend.
- Despliegue accesible con verificación de un flujo integrado.

Supabase está seleccionado para autenticación, base de datos y almacenamiento privado. El usuario confirmó las tablas, Google OAuth, las políticas RLS para puestos y ponderaciones, y un guardado real correcto de puesto y sus habilidades. La aplicación ya permite cargar, guardar y actualizar puestos desde Supabase. El hosting sigue pendiente. También resta definir duplicados, límites de archivo, retención y eliminación de datos personales. No hay una demo pública desplegada a la fecha de esta documentación. El trabajo colaborativo entre reclutadores y los bancos compartidos por empresa quedan como evolución futura.

## Tecnologías presentes

- React 19 y TypeScript.
- Vite.
- PDF.js (`pdfjs-dist`) para extraer texto de PDFs en el navegador.
- Azure OpenAI en el backend para evaluación e importación, si está configurado.
- Node.js nativo para una API autenticada de evaluación e importación de requisitos desde ofertas públicas.
- Playwright para pruebas end-to-end.
- Oxlint para análisis estático.

Hay una migración SQL inicial en `supabase/migrations/` con el esquema, las políticas RLS y el bucket privado. El usuario confirmó que la aplicó y la consulta a `pg_policies` confirma las políticas de las tablas de puestos. La migración `20261003214000_save_position_rpc.sql` agrega el guardado atómico de un puesto con sus habilidades; el usuario confirmó haberla aplicado y haber guardado un puesto correctamente. El usuario también confirmó haber aplicado `20261004150000_save_candidate_document_rpc.sql`, que habilita la persistencia atómica de candidatos y metadatos de CV; todavía falta probar una escritura real desde el flujo de la aplicación.

## Requisitos

- Node.js 22 o una versión compatible con Vite 8.
- npm.

## Instalación y ejecución local

Desde la carpeta raíz del proyecto:

```powershell
npm ci
npm run dev
```

Vite mostrará la URL local, normalmente `http://localhost:5173`.

Para habilitar el inicio de sesión, usá `.env.example` como referencia y agregá a `.env` `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con la URL del proyecto y su clave pública (publishable/anon). La clave anon es pública y se incluye en el cliente web. Permití `http://localhost:5173` en las URL de redirección de Supabase. No pongas claves `service_role`, secretos OAuth ni credenciales privadas en variables expuestas al frontend. Si faltan estos valores, la aplicación bloquea el acceso al espacio privado.

El guardado de candidatos requiere además `SUPABASE_SERVICE_ROLE_KEY` en el entorno local del backend. Es una credencial administrativa: mantenerla solo en `.env`/entorno del servidor, nunca en el frontend, en `VITE_*` ni en el repositorio.

El backend local sirve la evaluación protegida y la importación de requisitos. En una segunda terminal:

```powershell
npm run dev:api
```

Escucha en el puerto 3001 por defecto. Vite reenvía las rutas `/api` al backend.

## Configuración de Supabase y Google Auth

La autenticación con Supabase + Google ya está configurada. La guía de referencia está en:

Los pasos concretos están en [documentacion/configuracion-supabase-google-auth.md](documentacion/configuracion-supabase-google-auth.md). En resumen:

1. Confirmar que Google OAuth está habilitado en Supabase Authentication > Providers.
2. Configurar Google OAuth con Client ID y Client Secret si aún no está habilitado.
3. Permitir las origins del frontend (por ejemplo `http://localhost:5173`).
4. Verificar las políticas RLS y el bucket privado creados por la migración ya aplicada.
5. Mantener `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env` para el cliente y `SUPABASE_URL` y `SUPABASE_ANON_KEY` solo para el backend.
6. Nunca exponer `service_role` ni claves privadas en el bundle.

## Despliegue en Vercel

El frontend y las rutas privadas `/api/*` se despliegan en el mismo proyecto Vercel. `api/[...path].mjs` es una función Node catch-all que delega las solicitudes al mismo servidor probado localmente; incluye evaluación, candidatos, historial e importación. La función permite hasta 120 segundos para completar las llamadas autenticadas a Supabase y Azure OpenAI.

1. Configurar el **Root Directory** del proyecto Vercel como `talentiq`, con `npm run build` como build command y `dist` como output directory.
2. En Vercel > **Settings > Environment Variables**, crear:
   - `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`: valores públicos que Vite incorpora al frontend durante el build.
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `AZURE_OPENAI_DEPLOYMENT` y `AZURE_OPENAI_API_VERSION`: variables del backend; no llevan prefijo `VITE_`.
3. Habilitar las variables en Production (y Preview si se desea probar previews) y volver a desplegar para reconstruir el frontend.
4. Probar el flujo desde la aplicación. Si deja de responder 404 pero aparece un error 503, revisar la configuración de las variables del servidor; no agregar claves privadas al frontend.

El prefijo de Vite está limitado a `VITE_`, por lo que las variables privadas `SUPABASE_*` y `AZURE_OPENAI_*` del entorno de Vercel no se incluyen en el bundle del navegador.

El guardado de puestos requiere `supabase/migrations/20261003214000_save_position_rpc.sql`, ya aplicada por el usuario en el proyecto. La función inserta o actualiza el puesto y reemplaza sus habilidades dentro de una sola transacción, y valida que el puesto pertenezca al usuario autenticado.

El guardado del candidato y su CV requiere `supabase/migrations/20261004150000_save_candidate_document_rpc.sql`, que el usuario confirmó haber aplicado. Esta migración añade una operación atómica restringida a `service_role` para crear el candidato y registrar el documento procesado, además de la política que permite a cada usuario eliminar sus propios objetos CV. La aplicación sube el PDF con la sesión autenticada; el backend valida esa sesión antes de registrar metadatos y texto extraído. Cada carga nueva crea un candidato; la detección de duplicados queda pendiente.

## Configuración de IA

Configurar `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `AZURE_OPENAI_DEPLOYMENT` y `AZURE_OPENAI_API_VERSION` para el proceso Node del backend, usando `.env.example` como referencia. Estas variables no deben tener el prefijo `VITE_`: Vite incorpora las variables `VITE_*` al cliente. El endpoint `/api/evaluate-candidate` valida el token de sesión con Supabase antes de llamar a Azure; la importación de ofertas también requiere autenticación.

Si una clave de Azure se configuró anteriormente como `VITE_AZURE_OPENAI_KEY` o se usó en una compilación accesible, revocarla y crear una nueva antes de volver a habilitar el servicio. No se debe considerar privada una clave que ya pudo estar incluida en un bundle.

Las pruebas automatizadas simulan la respuesta de evaluación; no verifican credenciales ni conectividad reales con Azure OpenAI.

## Pruebas y validaciones

```powershell
npm run lint
npm run build
npm run test:server
npx playwright test
```

Las pruebas E2E cubren autenticación, definición de requisitos, carga del CV individual, evaluación simulada y su contrato de persistencia; las pruebas de servidor simulan Supabase y Azure. El usuario verificó un guardado real de puesto en Supabase. La persistencia de candidatos requiere aplicar la migración nueva y configurar la clave administrativa server-side. Carga masiva, solicitudes, historial, etapas, generación de preguntas y despliegue todavía deben incorporarse.

## Estructura principal

```text
src/
  components/   Componentes de la interfaz
  services/     Evaluación e importación de requisitos del MVP
  App.tsx       Flujo principal actual
  types.ts      Contratos actuales
server/
  server.mjs    API autenticada para evaluación e importación de requisitos
  server.test.mjs Pruebas de autenticación y rutas protegidas
tests/          Pruebas end-to-end del MVP
documentacion/
  arquitectura-y-alcance.md
  alcance-entrega-final-y-historias.md
supabase/
  migrations/     Esquema privado aplicado y migraciones de funcionalidad
```
