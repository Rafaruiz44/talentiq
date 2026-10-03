# Talentiq

Talentiq es una aplicación de apoyo a reclutadores para comparar requisitos de una posición con la información de un CV y revisar un puntaje, un veredicto y un desglose de fortalezas y brechas. La evaluación ayuda al análisis inicial; no reemplaza la decisión humana de selección.

## Estado del proyecto

El repositorio contiene el MVP ejecutable localmente. El alcance acordado para la entrega final amplía ese MVP con cuentas de reclutadores mediante Google, espacios privados por reclutador, posiciones y candidatos persistentes, carga masiva, solicitudes candidato–posición, historial de evaluaciones, seguimiento de etapas, preguntas de entrevista y despliegue accesible.

Esas capacidades ampliadas están planificadas y no deben considerarse implementadas solo por estar documentadas. La arquitectura objetivo, el estado actual y las decisiones pendientes se describen en [documentacion/arquitectura-y-alcance.md](documentacion/arquitectura-y-alcance.md); las historias y sus criterios de aceptación están en [documentacion/alcance-entrega-final-y-historias.md](documentacion/alcance-entrega-final-y-historias.md).

## Funcionalidades actuales del MVP

- Definir el nombre del puesto, habilidades con peso individual y seniority requerido con su peso.
- Cargar un CV PDF individual de hasta 5 MB y extraer su texto con PDF.js en el navegador.
- Ejecutar un análisis de compatibilidad y mostrar puntaje, veredicto `Apto` o `No Apto`, fortalezas y brechas.
- Cambiar entre tema claro y oscuro; la preferencia se conserva en `sessionStorage`.

El umbral actual de aprobación está fijado en 70 %. La posición, el CV y el resultado se mantienen en memoria; no existe persistencia de esos datos. Si Azure OpenAI no está configurado, el MVP usa una evaluación local de respaldo.

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

Supabase está seleccionado para autenticación, base de datos y almacenamiento privado. El usuario confirmó que las tablas de la migración están creadas en su proyecto; falta verificar allí las políticas RLS, el bucket y Google OAuth. El hosting sigue pendiente. También resta definir duplicados, límites de archivo, retención y eliminación de datos personales. No hay una demo pública desplegada a la fecha de esta documentación. El trabajo colaborativo entre reclutadores y los bancos compartidos por empresa quedan como evolución futura.

## Tecnologías presentes

- React 19 y TypeScript.
- Vite.
- PDF.js (`pdfjs-dist`) para extraer texto de PDFs en el navegador.
- Azure OpenAI en el flujo actual de evaluación, si está configurado.
- Node.js nativo para una API auxiliar de importación de requisitos desde ofertas públicas.
- Playwright para pruebas end-to-end.
- Oxlint para análisis estático.

Hay una migración SQL inicial en `supabase/migrations/` con el esquema, las políticas RLS y el bucket privado. El usuario confirmó que la aplicó; la captura del Table Editor muestra las tablas esperadas. Esta aplicación todavía no usa la base de datos ni el bucket para persistir datos, y las políticas RLS y el bucket aún no se han comprobado desde el dashboard.

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

Para habilitar el inicio de sesión, usá `.env.example` como referencia y agregá a `.env` `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con la URL del proyecto y su clave pública (publishable/anon). Permití `http://localhost:5173` en las URL de redirección de Supabase. No pongas claves `service_role`, secretos OAuth ni credenciales privadas en variables `VITE_`. Si faltan estos valores, la aplicación bloquea el acceso al espacio privado.

El servidor auxiliar de importación se ejecuta por separado:

```powershell
node server/server.mjs
```

Escucha en el puerto 3001 por defecto y requiere configurar las variables de Azure OpenAI en el entorno del proceso para usar la importación asistida. Este endpoint auxiliar no forma parte del flujo principal de evaluación del MVP.

## Configuración de Supabase y Google Auth

Antes de avanzar con persistencia, almacenamiento privado y flujo de reclutador, debe configurarse la autenticación real con Supabase + Google.

Los pasos concretos están en [documentacion/configuracion-supabase-google-auth.md](documentacion/configuracion-supabase-google-auth.md). En resumen:

1. Confirmar que Google OAuth está habilitado en Supabase Authentication > Providers.
2. Configurar Google OAuth con Client ID y Client Secret si aún no está habilitado.
3. Permitir las origins del frontend (por ejemplo `http://localhost:5173`).
4. Verificar las políticas RLS y el bucket privado creados por la migración ya aplicada.
5. Mantener `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env` únicamente.
6. Nunca exponer `service_role` ni claves privadas en el bundle.

## Configuración de IA

El código actual reconoce las variables `VITE_AZURE_OPENAI_ENDPOINT`, `VITE_AZURE_OPENAI_KEY`, `VITE_AZURE_OPENAI_DEPLOYMENT` y `VITE_AZURE_OPENAI_API_VERSION` para su evaluación desde el navegador. Por el prefijo `VITE_`, los valores pueden quedar incluidos en el bundle público: **no configurar una clave real de Azure de esta manera en un despliegue accesible**.

Para la entrega final, las llamadas de evaluación y generación de preguntas deben pasar por el backend y las credenciales deben configurarse únicamente en el entorno seguro del servidor. La integración real con Azure no queda verificada por las pruebas actuales.

## Pruebas y validaciones

```powershell
npm run lint
npm run build
npx playwright test
```

Las pruebas E2E cubren el requisito de autenticación y el inicio del flujo OAuth, además de definición de requisitos, carga y análisis de un CV, y cambio de tema. El cliente de Supabase se conecta para autenticar reclutadores; persistencia, aislamiento entre cuentas en datos, lotes, solicitudes, historial, etapas, generación de preguntas y despliegue todavía deben incorporarse.

## Estructura principal

```text
src/
  components/   Componentes de la interfaz
  services/     Evaluación e importación de requisitos del MVP
  App.tsx       Flujo principal actual
  types.ts      Contratos actuales
server/
  server.mjs    API auxiliar para importar requisitos de ofertas
tests/          Pruebas end-to-end del MVP
documentacion/
  arquitectura-y-alcance.md
  alcance-entrega-final-y-historias.md
supabase/
  migrations/     Esquema inicial propuesto; pendiente de aplicar y validar
```
