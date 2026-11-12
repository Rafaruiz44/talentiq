# Talentiq: proyecto actual

**Actualizado:** 12 de noviembre de 2026
**Estado general:** entrega final completa y desplegada en [https://talentiq-pi.vercel.app/](https://talentiq-pi.vercel.app/).

Este documento registra el estado de cada funcionalidad, cómo se verificó y qué quedó fuera del alcance. Distingue lo verificado con servicios reales (Supabase y Azure OpenAI) de lo probado solo con servicios simulados.

## Resumen

Un reclutador inicia sesión con Google y trabaja en un espacio privado. Define puestos con habilidades ponderadas, seniority y porcentaje mínimo de aceptación; carga varios CVs en PDF desde Postulaciones; consulta el banco de candidatos y reutiliza CVs en otros puestos; y revisa un ranking por puesto con fortalezas, brechas y preguntas de entrevista para los aptos. Puede abrir o cerrar puestos y descartar candidatos.

Todas las funcionalidades de la tabla siguiente están desplegadas en Vercel y verificadas por el equipo con Supabase y Azure OpenAI reales, incluidas las preguntas de entrevista, el descarte y la ruta `/api/candidates/lookup`.

## Implementado y verificado

| Área | Estado actual |
|---|---|
| Acceso | Inicio y cierre de sesión con Google mediante Supabase Auth. La app bloquea el espacio privado si no hay sesión. |
| Puestos | Listado, creación, detalle y edición, guardados en Supabase y aislados por `recruiter_id`. `save_position` persiste el puesto y sus habilidades en una operación transaccional que toma la identidad de la sesión. |
| Requisitos | Nombre del puesto, habilidades con peso de 1 a 10, seniority requerido con su peso y porcentaje mínimo de aceptación entre 50 % y 100 %, en incrementos de 5 (70 % por defecto). |
| Estado del puesto | `Abierta` o `Cerrada`. Se cambia desde el listado de puestos. Mientras está cerrado, el puesto bloquea la carga de PDFs y la evaluación de candidatos guardados, y Postulaciones muestra un aviso para abrirlo. |
| Selector de posiciones | Los selectores de Postulaciones y Ranking muestran solo posiciones abiertas; la casilla "Incluir cerrados" muestra también las cerradas. La posición seleccionada se mantiene visible aunque se cierre. |
| Carga de CVs | En Postulaciones, selección múltiple o arrastre de PDF de hasta 5 MB por archivo. PDF.js extrae el texto en el navegador. Los archivos se procesan uno por uno, cada uno informa su progreso y sus errores y un fallo no frena al resto. Un CV con texto idéntico a uno ya guardado se reutiliza sin crear otro candidato; una comprobación transaccional cubre cargas concurrentes. |
| Banco de candidatos | Listado privado con búsqueda por nombre o archivo, datos de contacto extraídos del CV, cantidad de CVs y fecha del más reciente. Permite elegir un puesto y evaluar un CV guardado sin volver a subirlo. |
| Postulaciones | Cada análisis exitoso guarda o reutiliza el candidato y su documento, y persiste la evaluación como solicitud candidato–posición. La pantalla lista los candidatos ya evaluados para el puesto. |
| Ranking | Ordena los candidatos de un puesto por porcentaje de compatibilidad, con nombre, archivo, veredicto, puntaje y fecha. Un panel desplegable muestra fortalezas, brechas y, para los aptos, las preguntas de entrevista. Usa el veredicto persistido, que la base recalcula cuando cambia el umbral del puesto. |
| Descartar candidatos | En Ranking y en la lista de evaluados de Postulaciones, el botón Descartar guarda la etapa `Descartado` en la solicitud (solo para el reclutador dueño, por la política RLS de actualización). Los descartados se ocultan por defecto, se pueden mostrar atenuados y volver a `Evaluado` con Restaurar. La etapa se conserva al re-evaluar. |
| Evaluación | Antes de llamar a Azure, el backend valida la sesión y busca una evaluación con el mismo candidato, CV, puesto, requisitos y versión del evaluador (`candidate-evaluation-v21`); si existe, la reutiliza sin consumir tokens. Si no, Azure OpenAI devuelve `skillAssessments` (una decisión `met` con evidencia por cada habilidad) y `seniorityMatchesRole`. El modelo reconoce sinónimos, abreviaturas, otros idiomas y herramientas que implican la habilidad, y no cuenta objetivos de aprendizaje ni tecnologías distintas de nombre parecido. Para el seniority, Trainee acepta proyectos académicos o personales; los demás niveles solo tiempo laboral formal en experiencias compatibles con el área, decididas por el cargo y las tareas y no por las herramientas compartidas. El backend exige una decisión por cada habilidad (compara nombres sin distinguir mayúsculas ni acentos) y responde con error si falta alguna; calcula el puntaje con esas decisiones, redondea el porcentaje al entero más cercano y decide el veredicto con el umbral del puesto. Para los aptos genera exactamente tres preguntas de entrevista y las guarda en `interview_questions`. Cada solicitud conserva una sola evaluación vigente: re-evaluar la reemplaza. |
| Re-análisis al editar un puesto | Si solo cambia el porcentaje mínimo, se recalcula el veredicto con los puntos guardados sin llamar a Azure. Si cambian habilidades, pesos o seniority, se vuelve a evaluar con Azure a los candidatos del puesto, incluidos los descartados. Si solo cambia el nombre, no se tocan las evaluaciones. |
| Seguridad | Todas las rutas privadas de la API validan el token de Supabase. Las credenciales de Azure OpenAI y `SUPABASE_SERVICE_ROLE_KEY` existen solo en el servidor; al navegador solo llegan las variables `VITE_*` (`envPrefix` en `vite.config.ts`). Las escrituras de candidatos y evaluaciones pasan por funciones de la base restringidas al servidor. |
| Despliegue | Frontend y API en Vercel. `api/[...route].mjs` adapta las rutas generales a Vercel Functions y `api/candidates.mjs` y `api/candidates/lookup.mjs` exponen las rutas de candidatos. |
| Presentación | Navegación por puestos, candidatos, postulaciones y ranking con migas de pan; diseño adaptable y tema claro u oscuro, cuya preferencia se conserva en `sessionStorage`. |

## Fuera del alcance de la entrega

Estas funcionalidades quedaron fuera de la entrega final:

- Asignar la etapa `En entrevista` desde la interfaz. La base ya la admite; `Descartado` ya está disponible.
- Detectar a la misma persona cuando sube un CV actualizado. Hoy solo se reconoce un CV con texto idéntico.
- Eliminar candidatos y documentos desde la aplicación.
- Historial completo de evaluaciones por solicitud y una vista para consultarlo. Hoy cada solicitud conserva solo su evaluación vigente (migración `20261023224500_single_current_evaluation.sql`).
- Conectar la importación de requisitos desde ofertas de LinkedIn o Computrabajo al formulario de puestos. El componente, el servicio cliente y el endpoint autenticado existen, pero el flujo no está conectado ni tiene pruebas E2E propias.

## Decisiones sin definir

- Consentimiento, retención y eliminación de datos personales y CVs.
- Limpieza de los archivos duplicados que quedaron en Storage antes de la detección de CVs idénticos.

## Validación ejecutada el 12 de noviembre de 2026

| Comando | Resultado |
|---|---|
| `npm run lint` | Aprobado. |
| `npm run build` | Aprobado. |
| `npm run test:server` | 29 de 29 pruebas del backend aprobadas. |
| `npx playwright test` | 30 de 30 pruebas end-to-end aprobadas. |

Las pruebas automatizadas usan Supabase y Azure OpenAI simulados. La verificación con servicios reales la realizó el equipo en el despliegue de Vercel; la validación de la evaluación con Azure real y la prueba manual en otros rubros están en [documentacion/pruebas-y-resultados.md](documentacion/pruebas-y-resultados.md).

## Cómo mantener este documento actualizado

Actualizar el resumen, la tabla de estado, lo que quedó fuera del alcance y la fecha en la misma tarea que cambie una capacidad visible o su integración con servicios. Si un cambio solo es interno y no modifica comportamiento, alcance, seguridad ni estado de despliegue, no hace falta cambiar este documento.

La actualización es deliberada y se hace junto con cada cambio; no se genera automáticamente a partir del código porque la diferencia entre "implementado" y "verificado en un servicio real" requiere contexto que una extracción automática no puede determinar de forma fiable. La instrucción para futuras tareas de desarrollo está en `AGENTS.md`.
