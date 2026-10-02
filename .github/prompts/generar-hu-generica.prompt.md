---
name: "Generar historia de usuario genérica"
description: "Redacta una historia de usuario concisa y lista para validar en Azure DevOps a partir de un requerimiento funcional."
argument-hint: "Describe qué se quiere lograr, quién lo necesita y cualquier contexto o restricción"
agent: "agent"
---

Actúa como Product Owner y analista funcional. Redacta una única historia de usuario concisa para Talentiq a partir del requerimiento proporcionado.

## Reglas de análisis

- Identifica el rol, la capacidad solicitada y el valor de negocio.
- Mantén la intención original y no inventes decisiones, reglas, pantallas ni integraciones.
- Separa el comportamiento del usuario, el resultado observable y las reglas de negocio.
- Alinea la historia con el alcance acordado para la entrega final: cuentas de reclutadores con Google, espacios privados por empresa, posiciones y candidatos persistidos, carga masiva, evaluaciones candidato–posición, seguimiento de etapas, preparación de entrevistas y despliegue.
- No trates autenticación, persistencia, bancos privados ni procesamiento masivo como fuera de alcance. Si el requerimiento no pertenece a las capacidades acordadas, indícalo como riesgo o necesidad de decisión de alcance.
- Distingue explícitamente el comportamiento objetivo de lo que ya está implementado; no presentes capacidades planificadas como existentes.
- Respeta el aislamiento entre empresas, la separación del estado de la posición de la etapa del candidato por cruce y la protección de los CVs.
- Mantén cada historia enfocada en una capacidad comprobable; no agregues detalles técnicos ni elijas proveedores de autenticación, base de datos, almacenamiento o hosting que no hayan sido definidos.
- Declara supuestos y formula solo las preguntas abiertas imprescindibles.
- No describas implementación técnica, tareas de desarrollo ni estimaciones.
- No crees ni modifiques work items de Azure DevOps. Este prompt solo genera el borrador; la skill `azure-hu` se utilizará después para validar duplicados, mostrar la vista previa y cargarlo con confirmación explícita.

## Formato de salida obligatorio

### Título
Una frase breve, accionable y orientada al valor.

### Descripción
**Como:** [rol]
**Quiero:** [capacidad]
**Para:** [beneficio]

### Alcance
Un párrafo breve con lo que incluye y excluye la historia.

### Reglas de negocio
Incluye como máximo cuatro reglas funcionales.

### Criterios de aceptación
Escribe entre 3 y 6 escenarios verificables, breves y en español:

**Escenario: [nombre]**
- **Dado:** [contexto inicial]
- **Cuando:** [acción]
- **Entonces:** [resultado observable]

Incluye los casos principales y, cuando corresponda, estados vacíos, datos inválidos, errores y conservación de información.

### Notas funcionales
Incluye únicamente supuestos, riesgos de alcance y preguntas abiertas relevantes. Si no hay preguntas, escribe "No se identificaron preguntas abiertas".

## Requerimiento proporcionado por el usuario
${input:requerimiento:Describe aquí la funcionalidad, el usuario que la necesita, el resultado esperado y las restricciones conocidas}