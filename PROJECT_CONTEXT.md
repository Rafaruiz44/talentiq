# Talentiq — Contexto del proyecto

## 1. Objetivo de la entrega final

Talentiq es una aplicación de apoyo para reclutadores. La entrega final amplía el MVP para que cada reclutador autenticado tenga posiciones persistentes, un banco privado reutilizable de CVs, solicitudes candidato–posición, historial de evaluaciones, seguimiento de etapas y preparación de entrevistas.

La evaluación asistida por IA apoya el análisis; no sustituye la decisión del equipo reclutador.

## 2. Alcance acordado para la entrega

- Los reclutadores deben registrarse e iniciar sesión con Google, mediante un proveedor de autenticación por confirmar.
- En esta primera etapa cada reclutador es dueño de sus posiciones, solicitudes, candidatos y banco privado; no hay empresas, invitaciones ni colaboración entre cuentas.
- Las posiciones se persisten con requisitos, ponderaciones y estado independiente: `Nueva`, `Abierta`, `Cubierta` o `Cancelada`.
- Los candidatos y los metadatos, texto extraído y referencia al archivo de CV se persisten; los documentos se guardan en un bucket privado y cada reclutador solo accede a los suyos.
- Se pueden cargar varios CVs, procesándolos individualmente y mostrando progreso y errores por archivo.
- Un reclutador puede asociar un candidato de su banco a varias posiciones abiertas. Cada solicitud corresponde a una pareja candidato–posición.
- La etapa pertenece a la solicitud candidato–posición y usa `Evaluado`, `En entrevista` o `Descartado`; no es el estado de la posición.
- Cada reanálisis se conserva como una ejecución histórica de la solicitud sin sobrescribir evaluaciones previas.
- Se generan preguntas de entrevista utilizando los requisitos de la posición y las fortalezas o brechas del candidato en ese cruce.
- Las llamadas principales a Azure OpenAI deben ejecutarse desde el backend; las credenciales no deben exponerse en el frontend.
- El despliegue accesible es un objetivo de entrega y requiere verificar un flujo funcional integrado.

El alcance y las historias propuestas están en [documentacion/alcance-entrega-final-y-historias.md](documentacion/alcance-entrega-final-y-historias.md).

## 3. Estado actual implementado (no confundir con el alcance acordado)

- Stack en el repositorio: Vite, React 19 y TypeScript.
- `src/App.tsx` conserva los requisitos de una posición, un CV y el resultado en estado React en memoria.
- `src/components/JobRequirementsForm.tsx` permite definir el rol, habilidades ponderadas y seniority.
- `src/components/CvUpload.tsx` carga un PDF de hasta 5 MB y extrae texto en el navegador con PDF.js.
- `src/services/inferCandidateEvaluation.ts` contiene lógica de evaluación local y llama a Azure OpenAI directamente desde el navegador cuando están configuradas variables `VITE_*`.
- `server/server.mjs` expone una API auxiliar para importar requisitos de ofertas; no implementa persistencia, autenticación, carga de CVs ni el endpoint backend de evaluación del flujo principal.
- `supabase/migrations/20261002203000_initial_private_recruiter_schema.sql` contiene una propuesta inicial de esquema y políticas RLS; todavía no se aplicó a un proyecto Supabase ni se validó contra una instancia.
- Las pruebas Playwright existentes cubren definición del puesto, carga y análisis de un CV y cambio de tema. No cubren las historias ampliadas.
- La documentación existente indica que no hay demo pública desplegada.

Por tanto, persistencia, autenticación, aislamiento entre reclutadores, almacenamiento de CVs, carga masiva, solicitudes reutilizables, seguimiento de etapas, historial de evaluaciones, generación de preguntas y despliegue integrado son objetivos pendientes; no deben presentarse como funcionalidades ya implementadas.

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

Antes de implementar el alcance deben definirse el proveedor de autenticación, base de datos, bucket y hosting; la detección de candidatos duplicados; los límites y formatos de CV; y las reglas de consentimiento, retención y eliminación de datos personales. La colaboración mediante espacios compartidos por empresas queda para una posible etapa posterior.

No asumir decisiones sobre estas cuestiones sin confirmarlas.

## 7. Guía de navegación

- Flujo actual: `src/App.tsx`.
- Contratos actuales: `src/types.ts`.
- Requisitos de posición: `src/components/JobRequirementsForm.tsx`.
- Carga y extracción de CV: `src/components/CvUpload.tsx`.
- Evaluación actual: `src/services/inferCandidateEvaluation.ts`.
- API auxiliar actual: `server/server.mjs`.
- Pruebas actuales: `tests/`.
- Alcance y backlog propuestos: `documentacion/alcance-entrega-final-y-historias.md`.

Este archivo describe tanto el alcance acordado como las diferencias con la implementación presente. Actualizar la sección de estado actual cuando las capacidades pendientes se incorporen realmente.
