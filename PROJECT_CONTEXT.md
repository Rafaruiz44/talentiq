# Talentiq — Contexto del proyecto

## 1. Objetivo de la entrega final

Talentiq es una aplicación de apoyo para reclutadores. La entrega final amplía el MVP para que cada empresa tenga un espacio privado compartido por sus reclutadores, con posiciones persistentes, un banco reutilizable de CVs, evaluaciones candidato–posición, seguimiento de etapas y preparación de entrevistas.

La evaluación asistida por IA apoya el análisis; no sustituye la decisión del equipo reclutador.

## 2. Alcance acordado para la entrega

- Los reclutadores deben registrarse e iniciar sesión con Google, sujeto a seleccionar un proveedor de autenticación compatible.
- El primer reclutador crea una empresa y puede invitar a sus compañeros.
- Cada empresa tiene un banco privado compartido entre los reclutadores que pertenecen a ella; los datos y archivos de empresas distintas deben permanecer aislados.
- Las posiciones se persisten con requisitos, ponderaciones y estado independiente: `Nueva`, `Abierta`, `Cubierta` o `Cancelada`.
- Los candidatos y los metadatos, texto extraído y referencia al archivo de CV se persisten; los documentos se guardan en un bucket privado.
- Se pueden cargar varios CVs, procesándolos individualmente y mostrando progreso y errores por archivo.
- Un candidato puede evaluarse frente a varias posiciones abiertas. Cada cruce conserva un resultado independiente.
- La etapa pertenece al cruce candidato–posición y usa `Evaluado`, `En entrevista` o `Descartado`; no es el estado de la posición.
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
- Las pruebas Playwright existentes cubren definición del puesto, carga y análisis de un CV y cambio de tema. No cubren las historias ampliadas.
- La documentación existente indica que no hay demo pública desplegada.

Por tanto, persistencia, autenticación, aislamiento por empresa, almacenamiento de CVs, carga masiva, cruces reutilizables, seguimiento de etapas, generación de preguntas y despliegue integrado son objetivos pendientes; no deben presentarse como funcionalidades ya implementadas.

## 4. Modelo funcional de referencia

- **Empresa:** espacio privado al que pertenecen posiciones y candidatos.
- **Reclutador:** persona autenticada mediante Google.
- **Membresía:** relación de acceso entre reclutador y empresa.
- **Posición:** requisitos, ponderaciones y estado de la vacante.
- **Candidato:** perfil del banco privado de una empresa, con metadatos del CV, texto extraído y referencia al archivo privado.
- **Evaluación candidato–posición:** resultado, puntaje, fortalezas, brechas y etapa correspondientes a un candidato y una posición específicos.
- **Preguntas de entrevista:** asociadas al cruce candidato–posición que las contextualiza.

Una persona puede estar en varias posiciones y tener distintos resultados y etapas para cada una. El estado de la posición no modifica automáticamente las etapas de sus candidatos.

## 5. Reglas y criterios técnicos del proyecto

- No usar `any`.
- Mantener TypeScript estricto y seguir los patrones de componentes y exports existentes.
- Usar controles HTML nativos y `data-testid` kebab-case donde las pruebas lo requieran.
- Validar autorización en el backend para las operaciones sobre empresas, posiciones, candidatos, evaluaciones y archivos.
- No confiar en ocultar información en la interfaz como mecanismo de aislamiento entre empresas.
- Mantener claves y credenciales de servicios solo en el backend; no añadir secretos al bundle frontend ni a variables `VITE_*`.
- Los fallos de persistencia, almacenamiento y servicios de IA deben comunicarse explícitamente; no deben producir resultados con apariencia de éxito.
- Mantener o ampliar las pruebas E2E y agregar cobertura para aislamiento, persistencia, estados, procesamiento masivo y fallos parciales.

## 6. Decisiones pendientes

Antes de implementar el alcance deben definirse el proveedor de autenticación, base de datos, bucket y hosting; los roles y permisos dentro de una empresa; si una cuenta puede pertenecer a varias empresas; las invitaciones y su vencimiento; la detección de candidatos duplicados; la conservación de resultados al reanalizar; los límites y formatos de CV; y las reglas de consentimiento, retención y eliminación de datos personales.

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
