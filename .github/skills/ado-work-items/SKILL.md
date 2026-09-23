---
name: ado-work-items
description: "Gestionar y ampliar el backlog de Talentiq en Azure DevOps basándose en el MVP inicial, pero permitiendo nuevas Features y User Stories cuando el negocio o el producto lo requiera."
argument-hint: "Confirmá el proyecto y el equipo de Azure DevOps si no están definidos."
user-invocable: true
disable-model-invocation: false
---

# Backlog de Talentiq en Azure DevOps

## Objetivo

Mantener el backlog de Talentiq alineado con la visión del MVP inicial, pero sin tratarlo como un conjunto rígido e inmutable. El backlog base debe servir como punto de partida, y nuevas Features o User Stories pueden agregarse cuando surjan requerimientos adicionales, mejoras de usabilidad o ampliaciones del alcance del producto.

## Backlog base del MVP

El punto de partida del proyecto es este conjunto mínimo de valor:

### Feature 1 - Carga y definición del puesto

1. Como reclutador quiero ingresar los requerimientos del puesto (campo de texto para rol, tecnologías y requisitos excluyentes, validando que no esté vacío).
2. Como reclutador quiero cargar un CV (mediante selector de archivo o pegado directo de texto plano).

### Feature 2 - Análisis y resultados

3. Como reclutador quiero ejecutar el análisis inteligente (obteniendo porcentaje de match y veredicto Apto / No Apto).
4. Como reclutador quiero ver el desglose justificado (lista de fortalezas y brechas o habilidades faltantes).

## Regla de evolución del backlog

- El backlog base es una línea de partida, no un tope artificial.
- Si surge un nuevo requerimiento de negocio, una mejora funcional o una necesidad de UX, puede crearse una nueva User Story o Feature adicional.
- Antes de crear nueva capacidad, debe analizarse si esa historia pertenece al MVP, a una mejora del producto o a un alcance expansivo.
- Toda nueva User Story debe mantenerse alineada con la arquitectura del proyecto y con el objetivo del MVP, sin abandonar el foco de demo o clase.

## Procedimiento obligatorio

1. Identificar el proyecto y el equipo de Azure DevOps. Si falta alguno, solicitarlo antes de operar.
2. Inspeccionar y listar las herramientas MCP de Azure DevOps disponibles en la sesión. No asumir nombres, parámetros ni versiones de herramientas.
3. Elegir, según sus esquemas disponibles, herramientas para:
   - consultar proyectos, equipos y work items existentes;
   - crear Features y User Stories;
   - establecer la relación padre-hija;
   - leer los IDs y estados resultantes.
4. Mostrar un plan antes de crear cualquier work item. El plan debe incluir:
   - proyecto y equipo;
   - el backlog base o la ampliación propuesta;
   - Feature y User Story a crear;
   - la jerarquía Feature → User Story;
   - campos adicionales que se vayan a completar.
5. Esperar aprobación explícita del usuario. Sin aprobación, no crear ni modificar work items.
6. Crear primero la Feature asociada cuando corresponda.
7. Crear después la User Story o historias nuevas como hijas de su Feature correspondiente.
8. Verificar que todos los work items creados existan y que las relaciones padre-hija sean correctas.
9. Reportar los resultados en una tabla con columnas: tipo, título, ID, Feature padre y estado.

## Restricciones

- No hardcodear nombres de herramientas MCP: descubrirlas y usar las disponibles en cada sesión.
- No borrar, cerrar, cancelar ni cambiar de estado work items existentes.
- No crear duplicados sin consultar primero los work items existentes y obtener aprobación específica.
- No crear User Stories antes de que existan sus Features padre.
- Si una operación falla, detenerse, informar el error y no intentar acciones destructivas.
- Mantener el alcance consistente con la visión del producto y con la validación del negocio.
- Las nuevas historias deben justificarse con un requerimiento real, no agregarse por conveniencia.

## Criterio de finalización

La tarea termina cuando el backlog queda verificado, ya sea con el conjunto base del MVP o con la ampliación aprobada por el usuario. En caso de creación completa, incluir siempre la tabla final con los IDs y estados verificados.
