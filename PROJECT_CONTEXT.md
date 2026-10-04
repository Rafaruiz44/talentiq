# Talentiq — Contexto del proyecto

## 1. Objetivo de la entrega final

Talentiq es una aplicación de apoyo para reclutadores. La entrega final amplía el MVP para que cada reclutador autenticado tenga posiciones persistentes, un banco privado reutilizable de CVs, solicitudes candidato–posición, historial de evaluaciones, seguimiento de etapas y preparación de entrevistas.

La evaluación asistida por IA apoya el análisis; no sustituye la decisión del equipo reclutador.

## 2. Alcance acordado para la entrega

- Los reclutadores deben registrarse e iniciar sesión con Google mediante Supabase Auth.
- En esta primera etapa cada reclutador es dueño de sus posiciones, solicitudes, candidatos y banco privado; no hay empresas, invitaciones ni colaboración entre cuentas.
- Las posiciones se persisten con requisitos, ponderaciones y estado independiente: `Nueva`, `Abierta`, `Cubierta` o `Cancelada`.
- Los candidatos y los metadatos, texto extraído y referencia al archivo de CV se persisten; los documentos se guardan en un bucket privado y cada reclutador solo accede a los suyos.
- Se pueden cargar varios CVs, procesándolos individualmente y mostrando progreso y errores por archivo.
- Un reclutador puede asociar un candidato de su banco a varias posiciones abiertas. Cada solicitud corresponde a una pareja candidato–posición.
- La etapa pertenece a la solicitud candidato–posición y usa `Evaluado`, `En entrevista` o `Descartado`; no es el estado de la posición.
- Cada análisis con CV, puesto, requisitos o versión del evaluador distintos se conserva como una ejecución histórica. Si todas esas entradas coinciden con una ejecución guardada, se reutiliza el resultado sin agregar una fila idéntica.
- Se generan preguntas de entrevista utilizando los requisitos de la posición y las fortalezas o brechas del candidato en ese cruce.
- Las llamadas principales a Azure OpenAI deben ejecutarse desde el backend; las credenciales no deben exponerse en el frontend.
- El despliegue accesible es un objetivo de entrega y requiere verificar un flujo funcional integrado.

El alcance y las historias propuestas están en [documentacion/alcance-entrega-final-y-historias.md](documentacion/alcance-entrega-final-y-historias.md).

## 3. Estado actual implementado (no confundir con el alcance acordado)

- Stack en el repositorio: Vite, React 19 y TypeScript.
- `src/App.tsx` conserva el CV y el resultado en estado React; los puestos guardados y sus habilidades se cargan desde Supabase y pueden crearse o actualizarse.
- La interfaz autenticada usa un shell Modern SaaS adaptable y separa los flujos en `/puestos` (listado), `/puestos/nuevo` (creación), `/puestos/:id` (detalle, carga y evaluación de CV) y `/puestos/:id/editar` (edición). La navegación usa History API, sin agregar una dependencia de routing.
- `src/services/positions.ts` consulta los puestos del reclutador autenticado y persiste cada puesto y sus habilidades con la función transaccional `save_position`.
- `src/components/PositionList.tsx` presenta los puestos del reclutador y permite abrir su detalle o crear uno nuevo.
- `src/components/JobRequirementsForm.tsx` permite definir o editar el rol, habilidades ponderadas y seniority.
- `src/components/CvUpload.tsx` carga un PDF de hasta 5 MB y extrae texto en el navegador con PDF.js. `src/services/candidates.ts` comprueba si el mismo texto ya existe para el reclutador y reutiliza el candidato y documento; si no existe, sube el archivo al bucket privado y pide al backend guardar candidato, metadatos y texto.
- `src/services/inferCandidateEvaluation.ts` envía requisitos, texto del CV y el puesto a `POST /api/evaluate-candidate` con el token de sesión; valida y normaliza la respuesta en el cliente.
- `server/server.mjs` valida los tokens mediante Supabase antes de las rutas privadas, mantiene las credenciales Azure en variables server-side `AZURE_OPENAI_*`, consulta el historial antes de invocar Azure y persiste evaluaciones nuevas mediante RPCs de servicio.
- La persistencia de candidato/documento usa funciones transaccionales definidas en `supabase/migrations/20261004150000_save_candidate_document_rpc.sql` y `supabase/migrations/20261004170000_deduplicate_candidate_documents.sql`; el bucket tiene una política para que el reclutador pueda limpiar una carga fallida.
- La consulta y escritura idempotente de evaluaciones usa `supabase/migrations/20261004180000_reuse_unchanged_evaluations.sql`. La migración `20261004190000_reuse_legacy_unchanged_evaluations.sql` extiende la búsqueda a evaluaciones antiguas sin huella, solo si el CV coincide exactamente y la posición no se modificó desde esa evaluación.
- En desarrollo, `npm run dev:api` inicia el backend y Vite reenvía `/api` al puerto 3001. Las rutas backend tienen pruebas Node en `server/server.test.mjs`.
- El usuario confirmó que aplicó las migraciones `supabase/migrations/20261002203000_initial_private_recruiter_schema.sql` y `supabase/migrations/20261003214000_save_position_rpc.sql` en su proyecto Supabase; tras aplicar la segunda, confirmó que el puesto apareció correctamente.
- El usuario confirmó que Google está habilitado y que el inicio de sesión OAuth termina con la sesión activa en Talentiq. Al cerrar sesión vuelve a la pantalla de acceso; al iniciar otra vez, Google reutiliza la sesión del navegador y no solicita la contraseña. Se conserva este comportamiento SSO.
- El usuario compartió la consulta de `pg_policies`: `positions` y `position_skills` tienen políticas `SELECT`, `INSERT` y `UPDATE` con `recruiter_id = auth.uid()` para `authenticated`. Storage muestra las tres políticas previstas para `candidate-cvs`; no se ha inspeccionado el predicado completo de cada política de Storage.
- El usuario confirmó la ejecución satisfactoria de guardado de un puesto con la migración `save_position` aplicada.
- Las pruebas Playwright cubren autenticación y la interfaz de gestión de puestos con respuestas de Supabase simuladas; el usuario confirmó además que un puesto guardado apareció correctamente en el proyecto real.
- La documentación existente indica que no hay demo pública desplegada.

Por tanto, el login/logout de Google, el guardado de puestos y la persistencia de un PDF están conectados y probados contra el proyecto real por el usuario. `SUPABASE_SERVICE_ROLE_KEY` está configurada localmente. Las migraciones `20261004170000_deduplicate_candidate_documents.sql`, `20261004180000_reuse_unchanged_evaluations.sql` y `20261004190000_reuse_legacy_unchanged_evaluations.sql` deben aplicarse para habilitar deduplicación de CV, reutilización de evaluaciones nuevas y búsqueda segura de evaluaciones anteriores. La app todavía no muestra el banco de candidatos ni el historial; siguen pendientes la carga masiva, gestión de etapas, preguntas de entrevista y despliegue integrado.

## 4. Modelo funcional de referencia

- **Reclutador:** persona autenticada mediante Google.
- **Posición:** pertenece a un reclutador y conserva requisitos, ponderaciones y estado.
- **Candidato y documento:** pertenecen al banco privado del reclutador; el documento conserva metadatos, texto extraído y referencia al archivo.
- **Solicitud candidato–posición:** pertenece al reclutador y vincula un candidato con una posición; conserva la etapa independiente de ese proceso.
- **Ejecución de evaluación:** resultado histórico vinculado a una solicitud.
- **Preguntas de entrevista:** asociadas a una ejecución de evaluación concreta.

Un candidato puede estar en varias posiciones y tener distintas solicitudes, resultados y etapas. El estado de la posición no modifica automáticamente las etapas de sus solicitudes. Los datos de una cuenta no se comparten con otros reclutadores en esta primera etapa.

## 5. Reglas y criterios técnicos del proyecto

- No usar `any`.
- Mantener TypeScript estricto y seguir los patrones de componentes y exports existentes.
- Usar controles HTML nativos y `data-testid` kebab-case donde las pruebas lo requieran.
- Validar en el backend que la identidad autenticada sea propietaria de las posiciones, candidatos, solicitudes, evaluaciones y archivos solicitados.
- No confiar en ocultar información en la interfaz como mecanismo de aislamiento entre reclutadores.
- Mantener claves y credenciales de servicios solo en el backend; no añadir secretos al bundle frontend ni a variables `VITE_*`.
- Los fallos de persistencia, almacenamiento y servicios de IA deben comunicarse explícitamente; no deben producir resultados con apariencia de éxito.
- Mantener o ampliar las pruebas E2E y agregar cobertura para aislamiento por reclutador, persistencia, estados, historial de evaluaciones, procesamiento masivo y fallos parciales.

## 6. Decisiones pendientes

Supabase está seleccionado para autenticación, base de datos y almacenamiento privado. Google OAuth y las políticas RLS de las tablas de posiciones se comprobaron con el usuario, quien también validó un guardado real de puesto. También quedan por definir el hosting, la detección de candidatos duplicados, los límites y formatos de CV, y las reglas de consentimiento, retención y eliminación de datos personales. La colaboración mediante espacios compartidos por empresas queda para una posible etapa posterior.

No asumir decisiones sobre estas cuestiones sin confirmarlas.

## 7. Guía de navegación

- Flujo actual: `src/App.tsx`.
- Contratos actuales: `src/types.ts`.
- Requisitos de posición: `src/components/JobRequirementsForm.tsx`.
- Carga y extracción de CV: `src/components/CvUpload.tsx`.
- Evaluación actual: `src/services/inferCandidateEvaluation.ts`.
- API de evaluación e importación: `server/server.mjs`.
- Pruebas actuales: `tests/`.
- Alcance y backlog propuestos: `documentacion/alcance-entrega-final-y-historias.md`.

Este archivo describe tanto el alcance acordado como las diferencias con la implementación presente. Actualizar la sección de estado actual cuando las capacidades pendientes se incorporen realmente.
