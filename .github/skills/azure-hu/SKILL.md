---
name: azure-hu
description: "Crear y cargar historias de usuario en Azure DevOps usando las herramientas MCP disponibles. Usar cuando se solicite subir, registrar o crear una HU en una organización Azure DevOps."
argument-hint: "Indica la HU, el proyecto y el equipo de Azure DevOps; si falta alguno, se solicitará antes de crearla."
user-invocable: true
disable-model-invocation: false
---

# Historias de usuario en Azure DevOps

## Objetivo

Crear User Stories en un proyecto de Azure DevOps a partir de una historia proporcionada por el usuario, respetando los campos y herramientas disponibles en la sesión. La skill no limita la HU a un backlog fijo y no crea Features automáticamente salvo que el usuario lo solicite de forma explícita.

## Información necesaria

Antes de operar, identificar:

- Organización de Azure DevOps, si no está implícita en la conexión.
- Proyecto de Azure DevOps.
- Equipo de Azure DevOps, cuando la herramienta o el proceso lo requiera.
- Título de la HU.
- Descripción en formato Como / Quiero / Para.
- Criterios de aceptación.
- Feature o Epic padre, si corresponde.
- Prioridad, iteración, área, tags y otros campos requeridos por el proceso, si aplican.

Si faltan datos obligatorios, solicitar solo los datos faltantes antes de continuar. No inventar nombres de proyectos, equipos, Features, iteraciones ni valores de campos.

## Procedimiento obligatorio

1. Interpretar la HU proporcionada y convertirla en una propuesta de User Story sin cambiar su intención funcional.
2. Identificar el proyecto y el equipo de Azure DevOps. Si falta alguno, solicitarlo antes de operar.
3. Inspeccionar las herramientas MCP de Azure DevOps disponibles en la sesión. No asumir nombres, parámetros ni versiones de herramientas.
4. Consultar el proyecto, el equipo y los work items relacionados que sean necesarios.
5. Buscar posibles duplicados por título, contenido, Feature padre y otros identificadores disponibles.
6. Validar que la HU tenga, como mínimo, título, descripción y criterios de aceptación. Informar cualquier campo obligatorio adicional detectado.
7. Validar el formato de la HU antes de mostrar la vista previa. La descripción debe conservar saltos de línea, encabezados separados, listas con guiones y tablas Markdown con una fila por campo. La historia Como/Quiero/Para no puede quedar en un único párrafo.
8. Mostrar una vista previa antes de crear el work item. La vista previa debe incluir:
   - organización, proyecto y equipo;
   - tipo de work item: User Story;
   - título;
   - descripción;
   - criterios de aceptación;
   - Feature o Epic padre, si existe;
   - prioridad, tags, área, iteración y campos adicionales;
   - posibles duplicados encontrados;
   - campos que no pudieron determinarse.
9. Esperar confirmación explícita del usuario. Sin confirmación, no crear, editar ni relacionar work items.
10. Tras la confirmación, crear una única User Story con los campos validados.
11. Si se solicitó una relación padre-hija y el padre existe, establecerla usando la herramienta disponible.
12. Leer el work item creado y verificar título, descripción, criterios, proyecto, tipo, estado y relación padre-hija cuando corresponda.
13. Reportar el resultado en una tabla con las columnas: tipo, título, ID, proyecto, equipo, padre, estado y URL si está disponible.

## Reglas de seguridad y alcance

- No crear ni modificar ningún work item sin confirmación explícita posterior a la vista previa.
- No crear duplicados: si existe una HU similar, mostrarla y solicitar una decisión específica.
- No borrar, cerrar, cancelar ni cambiar de estado work items existentes.
- No modificar Features, Epics o historias existentes salvo que el usuario lo solicite expresamente y confirme una vista previa separada.
- No crear una Feature padre automáticamente para resolver una relación faltante.
- No inventar campos personalizados, valores de picklist, IDs, URLs ni estados.
- No aceptar ni cargar descripciones compactadas en un único párrafo cuando deban contener secciones, listas o tablas. Corregir el Markdown antes de la vista previa y mostrar el formato corregido.
- Antes de escribir en Azure DevOps, convertir el Markdown estructurado a HTML válido para los campos enriquecidos `System.Description` y `Microsoft.VSTS.Common.AcceptanceCriteria`. No enviar marcadores Markdown literales como `**`, `###`, `-` o `|` en esos campos.
- Las tablas HTML deben usar estilos inline compatibles con Azure DevOps: `border-collapse: collapse` en la tabla y `border: 1px solid` más `padding` en encabezados y celdas. No confiar únicamente en `border`, `cellpadding` o `cellspacing`, porque Azure puede ignorarlos visualmente.
- Usar únicamente las herramientas MCP de Azure DevOps descubiertas en la sesión.
- Si la creación falla, detenerse, informar el error y no repetir la operación automáticamente si existe riesgo de duplicado.
- Si la HU está incompleta, ayudar a completarla antes de crearla, pero no sustituir decisiones funcionales del usuario.
- Mantener la conversación en español, salvo que el usuario pida otro idioma.

## Formato obligatorio para la User Story

La HU debe entregarse con Markdown correctamente estructurado y cargarse en Azure DevOps como HTML válido para que la interfaz renderice el contenido. Separar cada sección con una línea en blanco, conservar los saltos de línea de la historia Como/Quiero/Para, usar listas con guiones y representar los datos tabulares con una tabla Markdown válida antes de convertirla a HTML. No unir encabezados y contenido ni devolver toda la HU como un único párrafo.

### Título

Una frase breve, accionable y orientada al valor.

### Descripción

Como: [rol]
Quiero: [capacidad]
Para: [beneficio]

### Criterios de aceptación

Usar escenarios verificables en formato:

Escenario: [nombre]
- Dado: [contexto inicial]
- Cuando: [acción]
- Entonces: [resultado observable]

### Notas funcionales

Incluir reglas de negocio, datos involucrados, supuestos y preguntas abiertas cuando sean necesarios para que la HU pueda implementarse y validarse.

## Criterio de finalización

La tarea termina cuando:

- la User Story fue creada y verificada, con su ID y estado informados; o
- la operación no pudo realizarse y se informó claramente el bloqueo, sin crear duplicados ni modificar datos de forma parcial.
