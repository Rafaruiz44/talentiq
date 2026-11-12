# Uso de IA en el ciclo de vida de Talentiq

**Trabajo práctico:** Inteligencia Artificial Aplicada  
**Entrega:** Final  
**Grupo:** 2  
**Institución:** Universidad Nacional de La Matanza  
**Carrera y período:** Ingeniería en Informática, 2026, segundo cuatrimestre

## Propósito

En Talentiq la inteligencia artificial tiene dos roles distintos:

1. Es parte del producto: un modelo de lenguaje evalúa cada CV frente a los requisitos de una posición y genera preguntas de entrevista para los candidatos aptos.
2. Es una herramienta de ingeniería: el equipo declara haber usado GitHub Copilot y asistentes relacionados durante el diseño, la implementación, las pruebas, la documentación y tareas de control de versiones.

Este documento separa los hechos observables en el repositorio de las prácticas informadas por el equipo. Las presentaciones del grupo y la descripción del equipo son fuentes de contexto, no sustituyen registros de ejecución ni métricas.

## IA integrada en el producto

El cliente envía al backend los requisitos ponderados de una posición y el texto extraído del CV, junto con el token de sesión de Supabase. El backend verifica la sesión y, si no hay una evaluación guardada para el mismo CV, puesto y versión del evaluador, llama a Azure OpenAI con credenciales que solo existen en el servidor.

El prompt le pide al modelo una respuesta JSON con una decisión por cada habilidad del puesto (si el CV la acredita y con qué evidencia), la decisión sobre el seniority requerido y tres preguntas de entrevista si el candidato resulta apto. El modelo reconoce sinónimos, abreviaturas, otros idiomas y herramientas que implican una habilidad, y no cuenta objetivos de aprendizaje ni herramientas distintas de nombre parecido. El backend valida la respuesta, calcula el puntaje con esas decisiones, decide el veredicto con el umbral del puesto y guarda el resultado. El puntaje no depende de un número escrito por el modelo ni puede modificarse desde el navegador.

Si Azure OpenAI no está configurado o el servicio falla, el producto muestra un error y no presenta una evaluación local de respaldo. Según informó el equipo, el deployment de Azure OpenAI usa el modelo GPT 5.6 sol, que no admite fijar la temperatura; la estabilidad de los resultados entre corridas se apoya en reglas explícitas del prompt. La validación del comportamiento del modelo con Azure real está en [pruebas-y-resultados.md](./pruebas-y-resultados.md).

## IA como apoyo al SDLC

La presentación del grupo informa que se utilizó GitHub Copilot, agentes personalizados y MCP en distintas etapas. El repositorio contiene instrucciones, agentes, skills, prompts y pruebas que respaldan la existencia de ese flujo de trabajo. La tabla diferencia esa evidencia disponible de los datos que requieren registros adicionales del equipo.

| Etapa | Uso informado por el equipo | Evidencia disponible | Control humano |
|---|---|---|---|
| Diseño y backlog | Apoyo para transformar necesidades en historias de usuario, arquitectura y planes técnicos. | La presentación describe el flujo Arquitecto → plan → Ejecutor. El repositorio incluye instrucciones y una skill para preparar User Stories de Azure DevOps. | El equipo define alcance, revisa criterios y confirma antes de crear o relacionar historias. |
| Implementación | Generación y refactorización incremental de código con asistencia de Copilot. | La presentación informa este uso; las reglas del proyecto delimitan cómo debe trabajar la asistencia. No se incluye aquí un historial completo de sugerencias aceptadas. | El equipo revisa cambios, diagnósticos y comportamiento antes de conservarlos. |
| Testing | Exploración de la interfaz y elaboración de pruebas E2E basadas en elementos observados. | Hay agentes e instrucciones de QA, una skill que exige snapshot real antes de elegir locators y pruebas Playwright en `tests/`. | QA verifica la interfaz real; una prueba no debe modificar el comportamiento del producto para pasar. |
| Documentación | Asistencia para estructurar y redactar documentación del producto. | El README del proyecto y este conjunto de documentos forman parte de la documentación actual. | El equipo contrasta cada afirmación con el código, la presentación y resultados comprobables. |
| Control de versiones | Asistencia para organizar cambios y trabajar de forma aislada en ramas. | Las instrucciones del repositorio especifican revisar la rama, aislar cambios en ramas de tarea y no publicar cambios remotos desde el agente. | El equipo conserva el control de las operaciones Git y de cualquier publicación remota. |
| Infraestructura y despliegue | La presentación informa asistencia con Azure y configuración. | El código incluye la configuración de Azure OpenAI, la API Node adaptada a Vercel Functions y las migraciones de Supabase. La aplicación está desplegada en [https://talentiq-pi.vercel.app/](https://talentiq-pi.vercel.app/). | El equipo configuró los servicios y verificó el despliegue con Supabase y Azure reales. |

## Flujo de trabajo con agentes

La presentación describe una separación de responsabilidades entre análisis e implementación. En el repositorio, el agente Arquitecto está definido como de solo lectura: analiza el código, propone archivos y pasos y entrega un plan. Su configuración incluye un handoff hacia el agente ejecutor. Las instrucciones del equipo indican que la implementación se valida de forma incremental y bajo supervisión humana.

Para QA, las reglas requieren observar la aplicación y su árbol de accesibilidad antes de escribir locators. La skill de Playwright prioriza `getByRole`, `getByLabel` y `getByTestId`, prohíbe inventar selectores y ordena detenerse y reportar si el hallazgo corresponde a un defecto del producto.

La skill de Azure DevOps establece validaciones de User Stories, búsqueda de duplicados y presentación de una vista previa antes de crear un work item. El equipo debe confirmar la creación.

## Ejemplos observables en esta interacción

Los siguientes ejemplos corresponden a tareas registradas durante la preparación de esta documentación; no pretenden representar todo el historial de desarrollo del grupo:

- **Análisis de alcance:** se consultó cómo separar vacantes y CVs para evolucionar desde el flujo de un CV contra una posición hacia un banco de talentos. La respuesta se contrastó con las limitaciones del MVP y se dejó la evolución fuera del alcance documentado como implementado.
- **Documentación:** se solicitó redactar el README y luego documentos técnicos basados en el repositorio y la presentación. Las afirmaciones se contrastaron con `App.tsx`, los servicios, las pruebas y la configuración.
- **Control del cambio documental:** se verificó la rama antes de editar y se validó el Markdown mediante diagnósticos disponibles. El build del proyecto también se ejecutó al actualizar el README; su resultado se registra en el documento de pruebas cuando corresponda a la entrega.

Estos ejemplos muestran asistencia en análisis, documentación y validación en esta interacción. Para evidenciar prompts y sugerencias de Copilot usados durante la implementación original, el equipo debería adjuntar capturas o extractos reales del historial; no se reconstruyen ni inventan aquí.

## Límites y responsabilidad

- La IA puede producir respuestas incorrectas, incompletas o variables; la evaluación no debe ser la única base para una decisión laboral.
- El CV contiene datos personales. Solo se deben procesar datos autorizados y evitar su inclusión en capturas, reportes o ejemplos públicos.
- El LLM puede devolver contenido inválido o no ajustado al contrato; el backend valida la respuesta y, si no cumple, informa el error en lugar de mostrar un resultado.
- La configuración local de Azure y las credenciales no forman parte de esta documentación.
- La IA sugiere y acelera tareas; el equipo conserva la responsabilidad por requisitos, decisiones de diseño, revisión de código, aprobación de pruebas y publicación.

## Evidencias recomendadas para la entrega

Para respaldar las etapas que la presentación atribuye a Copilot y MCP, se recomienda conservar:

- Ejemplos reales de instrucciones y resultados de Copilot para diseño, historias de usuario e implementación.
- Capturas o registros del flujo de handoff entre agentes, si están disponibles.
- Reporte de Playwright y evidencia de los escenarios ejecutados.
- Historial de cambios o pull requests que permita identificar revisión humana, sin publicar secretos.
- Evidencia del despliegue en Vercel y de la configuración de los servicios, sin publicar secretos.

## Fuentes

- Presentaciones de Talentiq del Grupo 2 (MVP y entrega final), diapositivas sobre IA y SDLC.
- `.github/copilot-instructions.md` y `AGENTS.md`: reglas del proyecto y control humano.
- `.github/agents/arquitecto.agent.md` y `.github/agents/qa.agent.md`: roles de agentes.
- `.github/skills/azure-hu/SKILL.md` y `.github/skills/playwright-explore-and-test/SKILL.md`: procedimientos asistidos.
- `server/server.mjs`: prompt de evaluación, integración con Azure OpenAI y cálculo del puntaje.
- `tests/` y `server/server.test.mjs`: pruebas end-to-end y del backend.

**Nota de trazabilidad:** las afirmaciones sobre el uso de IA durante el desarrollo se basan en la presentación y en lo informado por el equipo. Los ejemplos de esta interacción son comprobables aquí; no se cuenta con el historial completo de conversaciones, commits o ejecuciones de todas las etapas del proyecto.