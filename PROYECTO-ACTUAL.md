# Talentiq — proyecto actual

**Actualizado:** 4 de octubre de 2026  
**Estado general:** MVP funcional en desarrollo; todavía no alcanza el alcance acordado para la entrega final.

Este documento separa las capacidades conectadas en la aplicación de las que solo tienen esquema, prototipos o planificación. La existencia de una tabla o una historia no significa que la función esté disponible para el usuario.

## Resumen

Hoy se puede iniciar sesión con Google, gestionar puestos guardados en Supabase y analizar un CV PDF individual contra los requisitos de un puesto. La evaluación y la importación de ofertas llaman a un backend que valida la sesión de Supabase antes de usar Azure OpenAI. La aplicación también ofrece tema claro/oscuro.

La app consulta el historial antes de llamar a Azure. Si el CV, el puesto y sus requisitos no cambiaron, reutiliza el resultado sin consumir tokens ni agregar otra ejecución; si no encuentra uno válido, hace un análisis nuevo y lo persiste. También puede reutilizar resultados históricos sin huella, siempre que el texto del CV coincida exactamente y el puesto no haya sido modificado desde aquella evaluación. La deduplicación y reutilización requieren las migraciones `20261004170000_deduplicate_candidate_documents.sql`, `20261004180000_reuse_unchanged_evaluations.sql` y `20261004190000_reuse_legacy_unchanged_evaluations.sql`; los duplicados ya existentes en Storage no se eliminan automáticamente. El usuario confirmó que previamente subió un PDF real desde la aplicación. La nueva búsqueda de historial aún requiere verificación contra Supabase real. Las credenciales Azure se leen solo como variables server-side `AZURE_OPENAI_*`; según la aclaración del usuario, se usaron en local, por lo que no hace falta rotarlas salvo que se hayan compartido o publicado.

## Implementado y conectado

| Área | Estado actual |
|---|---|
| Acceso | Inicio y cierre de sesión con Google mediante Supabase Auth. La app bloquea el espacio privado si no hay sesión. La suite prueba el flujo con Supabase simulado; el contexto del proyecto registra que el usuario también confirmó el OAuth real. |
| Puestos | Listado, creación, detalle y edición. Se guardan y consultan en Supabase, aislados por `recruiter_id`; `save_position` persiste puesto y habilidades en una operación transaccional. El contexto registra que el usuario confirmó la aplicación de las migraciones y un guardado real correcto. |
| Requisitos | Nombre/rol, seniority y peso del seniority, habilidades y peso individual de 1 a 10. |
| Estado del puesto | Se muestra el estado (`Nueva`, `Abierta`, `Cubierta` o `Cancelada`) recibido de Supabase. La interfaz crea puestos como `Nueva`, pero no ofrece acciones para cambiar ese estado. |
| CV individual | Selección o arrastre de un PDF de hasta 5 MB; PDF.js extrae el texto en el navegador. Los CV con texto extraído idéntico se reconocen por reclutador y se reutilizan sin otra carga normal al bucket; al guardar el CV se actualiza la huella de documentos históricos. Una segunda comprobación transaccional cubre cargas concurrentes. Los duplicados históricos permanecen en Storage y en la base hasta una limpieza explícita. |
| Evaluación | Antes de invocar Azure, el backend valida la sesión y consulta una ejecución que coincida con candidato, CV, puesto, requisitos y versión del evaluador. Reutiliza resultados nuevos y, con una condición adicional de CV idéntico y puesto sin cambios, resultados históricos sin huella. Si no encuentra coincidencia, invoca Azure y persiste el resultado. Los errores de consulta se informan; no se llama a Azure como fallback. El umbral actual es 70 %. Para invalidar resultados tras cambios del prompt o reglas, incrementar `evaluatorVersion`. |
| Presentación | Rutas de puestos, diseño adaptable y tema claro/oscuro; la preferencia del tema se conserva en `sessionStorage`. |
| Importación de ofertas | Hay componente, servicio cliente y endpoint Node autenticado para extraer requisitos desde ofertas públicas de LinkedIn o Computrabajo. El flujo no está conectado a la pantalla de creación de puestos y no tiene pruebas E2E propias. |

## Existe en la base de datos y se está conectando a la aplicación

La migración inicial define tablas para perfiles, candidatos, documentos, solicitudes, ejecuciones de evaluación y preguntas de entrevista, además de políticas RLS y un bucket privado `candidate-cvs`. También existen migraciones para guardar puestos y sus habilidades, y para persistir atómicamente el perfil y el documento de un CV.

La clave `SUPABASE_SERVICE_ROLE_KEY` ya está configurada en el `.env` local (se verificó su presencia sin leer ni mostrar el valor). El usuario confirmó que aplicó la migración de persistencia de CV y que un PDF quedó guardado correctamente desde la aplicación. Las migraciones `20261004170000_deduplicate_candidate_documents.sql`, `20261004180000_reuse_unchanged_evaluations.sql` y `20261004190000_reuse_legacy_unchanged_evaluations.sql` activan la detección de CVs duplicados, la búsqueda de evaluaciones y la reutilización segura de historial antiguo; deben aplicarse en Supabase antes de validar contra la instancia real. La aplicación todavía no muestra el historial ni el banco de candidatos.

## Pendiente para completar el alcance acordado

### Prioridad alta: seguridad y flujo persistente

- Rotar la clave de Azure solo si se compartió o publicó fuera del entorno local; el usuario indicó que el uso fue local.
- Al incorporar persistencia, validar en el backend la propiedad de posición, candidato, documento y solicitud para el reclutador autenticado.
- Aplicar en orden las migraciones `supabase/migrations/20261004170000_deduplicate_candidate_documents.sql`, `supabase/migrations/20261004180000_reuse_unchanged_evaluations.sql` y `supabase/migrations/20261004190000_reuse_legacy_unchanged_evaluations.sql`; probar un análisis histórico sin cambios y confirmar que no llama a Azure ni crea otra fila.
- Decidir si se limpian de forma controlada duplicados antiguos del bucket.
- Agregar una pantalla/listado del banco privado de candidatos y planificar una limpieza controlada de los archivos duplicados históricos.
- Implementar eliminación autorizada de candidatos y documentos desde la aplicación.
- Implementar la carga de varios CVs con progreso y errores independientes por archivo.
- Crear solicitudes por pareja candidato–posición y permitir reutilizar el candidato en distintas posiciones abiertas.
- Consultar y mostrar las ejecuciones de evaluación como historial; mantener la etapa (`Evaluado`, `En entrevista` o `Descartado`) por solicitud.
- Agregar acciones en la interfaz para gestionar los estados de las posiciones.

### Funcionalidades adicionales del alcance

- Generar y persistir preguntas de entrevista usando los requisitos y el resultado de la solicitud seleccionada.
- Conectar la importación de requisitos de ofertas al formulario de puestos y probar errores y respuestas inválidas.
- Completar pruebas de integración para persistencia real o entorno de prueba, autorización y aislamiento entre reclutadores, carga masiva, solicitudes, historial, etapas y preguntas.
- Desplegar la aplicación y verificar de punta a punta un flujo funcional con servicios configurados de forma segura.

### Decisiones que todavía requieren definición

- Hosting y estrategia de despliegue.
- Detección y tratamiento de candidatos duplicados.
- Límites y formatos de los archivos.
- Consentimiento, retención y eliminación de datos personales y CVs.

No se considera OCR de CVs escaneados como una capacidad implementada: el flujo actual extrae texto con PDF.js y no se encontró integración de OCR.

## Validación ejecutada el 4 de octubre de 2026

| Comando | Resultado |
|---|---|
| `npm run lint` | Finalizó correctamente. Oxlint informó una advertencia `react(set-state-in-effect)` en `src/App.tsx`. |
| `npm run build` | Finalizó correctamente. Vite informó chunks mayores a 500 kB: bundle principal de aproximadamente 899 kB y worker PDF de aproximadamente 1.265 kB. |
| `npm run test:server` | 15 pruebas backend aprobadas; incluyen reutilización de resultados nuevos e históricos sin llamar a Azure y nueva evaluación al cambiar requisitos. |
| `npx playwright test --reporter=line` | 17 pruebas E2E aprobadas en Chromium; incluyen reutilización del resultado en la segunda ejecución y deduplicación del CV. |

Las pruebas automatizadas usan respuestas simuladas de Supabase y Azure OpenAI; las de evaluación/persistencia en Playwright simulan API y Storage. Por lo tanto, no verifican conectividad real para la deduplicación ni la reutilización de evaluaciones. Aparte de esas pruebas, el usuario confirmó una carga real exitosa del PDF. Las migraciones nuevas quedan pendientes de aplicar y validar contra Supabase.

## Cómo mantener este documento actualizado

Actualizar el resumen, la tabla de estado, los pendientes y la fecha en la misma tarea que cambie una capacidad visible o su integración con servicios. Si un cambio solo es interno y no modifica comportamiento, alcance, seguridad ni estado de despliegue, no hace falta cambiar este documento.

La actualización es deliberada y se hace junto con cada cambio; no se genera automáticamente a partir del código porque la diferencia entre “implementado”, “conectado” y “verificado en un servicio real” requiere contexto que una extracción automática no puede determinar de forma fiable. La instrucción para futuras tareas de desarrollo está en `AGENTS.md`.
