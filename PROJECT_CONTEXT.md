# Talentiq: contexto del proyecto

## 1. Objetivo

Talentiq es una aplicación de apoyo para reclutadores. Cada reclutador autenticado tiene posiciones persistentes, un banco privado reutilizable de CVs, solicitudes candidato–posición evaluadas con IA, un ranking por posición, preguntas de entrevista para los candidatos aptos y la posibilidad de descartar candidatos.

La evaluación asistida por IA apoya el análisis; no sustituye la decisión del equipo reclutador.

La entrega final está desplegada en Vercel: [https://talentiq-pi.vercel.app/](https://talentiq-pi.vercel.app/).

## 2. Alcance de la entrega final

El alcance está implementado y verificado con Supabase y Azure OpenAI reales, salvo los pendientes de la sección 6.

- Los reclutadores inician sesión con Google mediante Supabase Auth.
- Cada reclutador es dueño de sus posiciones, solicitudes, candidatos y banco privado; no hay empresas, invitaciones ni colaboración entre cuentas.
- Las posiciones se persisten con requisitos, ponderaciones, porcentaje mínimo de aceptación y estado independiente: `Abierta` o `Cerrada`. Una posición cerrada conserva su información, pero no admite nuevas cargas ni evaluaciones hasta volver a abrirse.
- Los candidatos y los metadatos, texto extraído y referencia al archivo de CV se persisten; los documentos se guardan en un bucket privado y cada reclutador solo accede a los suyos.
- Se pueden cargar varios CVs a la vez; cada uno se procesa individualmente y muestra su progreso y sus errores.
- Un reclutador puede evaluar un candidato de su banco en varias posiciones. Cada solicitud corresponde a una pareja candidato–posición.
- La etapa pertenece a la solicitud candidato–posición (`Evaluado`, `En entrevista` o `Descartado`); no es el estado de la posición.
- Cada solicitud conserva su evaluación vigente. Si el CV, el puesto, los requisitos y la versión del evaluador coinciden con la evaluación guardada, se reutiliza sin llamar a Azure; si alguno cambió, se reemplaza.
- Se generan preguntas de entrevista con los requisitos de la posición y las fortalezas o brechas del candidato en ese cruce.
- Las llamadas a Azure OpenAI se ejecutan desde el backend; las credenciales no se exponen en el frontend.

El alcance y las historias de usuario están en [documentacion/alcance-entrega-final-y-historias.md](documentacion/alcance-entrega-final-y-historias.md).

## 3. Implementación

- Stack: Vite, React 19 y TypeScript en modo estricto. Hosting en Vercel para el frontend y la API.
- `src/App.tsx` administra la sesión, la navegación y los puestos guardados, y dispara el re-análisis de candidatos al editar un puesto. La interfaz separa los flujos en `/puestos` (listado), `/puestos/nuevo` (creación), `/puestos/:id` (detalle y acceso a Postulaciones), `/puestos/:id/editar` (edición), `/candidatos` (banco), `/postulaciones` (carga y evaluación) y `/ranking`. La navegación usa History API, sin dependencia de routing.
- `src/services/positions.ts` consulta los puestos del reclutador y persiste cada puesto y sus habilidades con la función transaccional `save_position`. También define qué posiciones aparecen en los selectores (las cerradas solo si se pide incluirlas).
- `src/components/PositionList.tsx` lista los puestos y permite ver su detalle, crear uno nuevo y abrirlo o cerrarlo.
- `src/components/JobRequirementsForm.tsx` define o edita el nombre, las habilidades ponderadas, el seniority y el porcentaje mínimo de aceptación entre 50 % y 100 % en incrementos de 5.
- `src/components/ApplicationIntake.tsx` es el punto de carga: acepta varios PDF de hasta 5 MB, los procesa secuencialmente, extrae el texto con PDF.js (`src/services/extractPdfText.ts`) y muestra progreso y errores por archivo. También evalúa candidatos guardados del banco y lista los ya evaluados para el puesto, con la opción de descartarlos. Una posición cerrada bloquea las cargas y las evaluaciones.
- `src/components/CandidateBank.tsx` muestra el banco privado con búsqueda y permite evaluar un CV guardado en otro puesto sin volver a subirlo.
- `src/components/PositionRanking.tsx` muestra la evaluación vigente de cada solicitud de un puesto, ordenada por compatibilidad, con fortalezas, brechas, preguntas de entrevista y descarte. `src/services/applicationRanking.ts` consulta `evaluation_runs` filtrando por puesto y reclutador, y actualiza la etapa de las solicitudes.
- `src/services/inferCandidateEvaluation.ts` envía requisitos, texto del CV y puesto a `POST /api/evaluate-candidate` con el token de sesión, y valida la respuesta. No recalcula el puntaje.
- `server/server.mjs` valida los tokens con Supabase antes de las rutas privadas, consulta el historial antes de invocar Azure, contiene el prompt de evaluación (versión `candidate-evaluation-v21`), calcula el puntaje con las decisiones por habilidad de la IA y persiste candidatos y evaluaciones mediante funciones de la base restringidas al servidor. Las credenciales de Azure están en variables server-side `AZURE_OPENAI_*`.
- `api/[...route].mjs` expone en Vercel el mismo handler Node usado localmente; `api/candidates.mjs` y `api/candidates/lookup.mjs` exponen las rutas de candidatos. En desarrollo, `npm run dev:api` inicia el backend y Vite reenvía `/api` al puerto 3001.
- `supabase/migrations/` contiene el esquema, las políticas RLS, el bucket privado `candidate-cvs` y las funciones de la base: guardado de puestos, guardado y detección de CVs idénticos, búsqueda y guardado de evaluaciones, preguntas de entrevista, umbral configurable y una única evaluación vigente por solicitud.
- Al navegador solo llegan las variables `VITE_*` (`envPrefix` en `vite.config.ts`); las variables de Supabase y Azure del servidor no usan ese prefijo.
- Las pruebas del backend están en `server/server.test.mjs` y las end-to-end en `tests/`; ambas usan servicios simulados. La validación con servicios reales está en [documentacion/pruebas-y-resultados.md](documentacion/pruebas-y-resultados.md).

El estado de cada funcionalidad y los pendientes se mantienen en [PROYECTO-ACTUAL.md](PROYECTO-ACTUAL.md).

## 4. Modelo funcional

- **Reclutador:** persona autenticada mediante Google.
- **Posición:** pertenece a un reclutador y conserva requisitos, ponderaciones, umbral de aceptación y estado.
- **Candidato y documento:** pertenecen al banco privado del reclutador; el documento conserva metadatos, texto extraído, huella del contenido y referencia al archivo.
- **Solicitud candidato–posición:** pertenece al reclutador y vincula un candidato con una posición; conserva la etapa independiente de ese proceso.
- **Ejecución de evaluación:** evaluación vigente de una solicitud.
- **Preguntas de entrevista:** asociadas a una ejecución de evaluación concreta.

Un candidato puede estar en varias posiciones y tener distintas solicitudes, resultados y etapas. El estado de la posición no modifica las etapas de sus solicitudes. Los datos de una cuenta no se comparten con otros reclutadores.

## 5. Reglas y criterios técnicos del proyecto

- No usar `any`.
- Mantener TypeScript estricto y seguir los patrones de componentes y exports existentes.
- Usar controles HTML nativos y `data-testid` kebab-case donde las pruebas lo requieran.
- Validar en el backend que la identidad autenticada sea propietaria de las posiciones, candidatos, solicitudes, evaluaciones y archivos solicitados.
- No confiar en ocultar información en la interfaz como mecanismo de aislamiento entre reclutadores.
- Mantener claves y credenciales de servicios solo en el backend; no añadir secretos al bundle frontend ni a variables `VITE_*`.
- Los fallos de persistencia, almacenamiento y servicios de IA deben comunicarse explícitamente; no deben producir resultados con apariencia de éxito.
- Mantener o ampliar las pruebas del backend y E2E al cambiar una funcionalidad.

## 6. Pendientes y decisiones sin definir

Pendientes:

- Asignar la etapa `En entrevista` desde la interfaz.
- Detectar a la misma persona cuando sube un CV actualizado; hoy solo se reconoce un CV con texto idéntico.
- Eliminar candidatos y documentos desde la aplicación.
- Historial completo de evaluaciones por solicitud y una vista para consultarlo; hoy se conserva solo la evaluación vigente.
- Conectar la importación de requisitos desde ofertas de LinkedIn o Computrabajo al formulario de puestos.

Sin definir: consentimiento, retención y eliminación de datos personales, y la colaboración mediante espacios compartidos por empresas. No asumir decisiones sobre estas cuestiones sin confirmarlas.

## 7. Guía de navegación

- Sesión, navegación y edición de puestos: `src/App.tsx`.
- Contratos: `src/types.ts`.
- Requisitos de posición: `src/components/JobRequirementsForm.tsx`.
- Carga de CVs y evaluación: `src/components/ApplicationIntake.tsx` y `src/services/extractPdfText.ts`.
- Banco de candidatos: `src/components/CandidateBank.tsx`.
- Ranking y descarte: `src/components/PositionRanking.tsx` y `src/services/applicationRanking.ts`.
- API, prompt y cálculo del puntaje: `server/server.mjs`.
- Pruebas: `server/server.test.mjs` y `tests/`.
- Alcance e historias: `documentacion/alcance-entrega-final-y-historias.md`.
