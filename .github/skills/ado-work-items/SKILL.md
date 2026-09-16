---
name: ado-work-items
description: "Cargar y mantener el backlog fijo de Talentiq en Azure DevOps mediante el MCP de Azure DevOps. Usar cuando se solicite crear, revisar o sincronizar Features y User Stories del MVP."
argument-hint: "Confirmá el proyecto y el equipo de Azure DevOps si no están definidos."
user-invocable: true
disable-model-invocation: false
---

# Backlog de Talentiq en Azure DevOps

## Objetivo

Cargar en Azure DevOps exactamente las 2 Features y 4 User Stories del MVP de Talentiq, respetando la jerarquía Feature → User Story.

## Backlog fijo

### Feature 1 - Carga y definición del puesto

1. Como reclutador quiero ingresar los requerimientos del puesto (campo de texto para rol, tecnologías y requisitos excluyentes, validando que no esté vacío).
2. Como reclutador quiero cargar un CV (mediante selector de archivo o pegado directo de texto plano).

### Feature 2 - Análisis y resultados

3. Como reclutador quiero ejecutar el análisis inteligente (obteniendo porcentaje de match y veredicto Apto / No Apto).
4. Como reclutador quiero ver el desglose justificado (lista de fortalezas y brechas o habilidades faltantes).

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
   - las 2 Features;
   - las 4 User Stories;
   - la jerarquía Feature → User Story;
   - campos adicionales que se vayan a completar.
5. Esperar aprobación explícita del usuario. Sin aprobación, no crear ni modificar work items.
6. Tras la aprobación, crear primero las 2 Features.
7. Crear después las 4 User Stories como hijas de sus Features correspondientes.
8. Verificar que todos los work items creados existan y que las relaciones padre-hija sean correctas.
9. Reportar los resultados en una tabla con columnas: tipo, título, ID, Feature padre y estado.

## Restricciones

- No hardcodear nombres de herramientas MCP: descubrirlas y usar las disponibles en cada sesión.
- No borrar, cerrar, cancelar ni cambiar de estado work items existentes.
- No crear work items fuera del backlog fijo.
- No crear User Stories antes de que existan sus Features padre.
- No crear duplicados sin consultar primero los work items existentes y obtener aprobación específica.
- Si una operación falla, detenerse, informar el error y no intentar acciones destructivas.
- Mantener los títulos y el alcance del backlog sin agregar funcionalidades.

## Criterio de finalización

La tarea termina solo cuando las 2 Features y las 4 User Stories están creadas o cuando se informa claramente qué elementos no pudieron crearse. En caso de creación completa, incluir siempre la tabla final con los IDs y estados verificados.
