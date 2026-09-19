---
name: "Generar HU de evaluación de CV desde oferta"
description: "Redacta una historia de usuario lista para Azure DevOps sobre cargar una oferta laboral mediante un enlace y usar sus requisitos para evaluar un CV."
argument-hint: "Describe el contexto, restricciones o criterios adicionales de la historia"
agent: "agent"
---

Actúa como Product Owner y analista funcional senior especializado en productos ATS y evaluación asistida por IA. Redacta una única historia de usuario lista para cargar en Azure DevOps para Talentiq.

## Contexto fijo del producto

Talentiq es un MVP para reclutadores. Su alcance incluye definir una vacante, cargar una oferta laboral mediante un enlace, cargar un CV y visualizar la compatibilidad entre ambos. El estado se mantiene en memoria y la IA puede estar simulada. No agregues autenticación, persistencia, procesamiento masivo ni funcionalidades fuera de este alcance.

## Objetivo de la historia

La historia debe cubrir este flujo funcional:

1. El reclutador ingresa o pega el enlace de una oferta laboral.
2. Talentiq obtiene y presenta los datos relevantes de la oferta, o permite confirmar/corregirlos si la extracción no es suficiente.
3. A partir de la oferta se identifican los requisitos que la IA debe considerar al evaluar un CV, separando cuando sea posible requisitos obligatorios, deseables, experiencia, habilidades, educación, ubicación, modalidad y otros criterios relevantes.
4. El reclutador puede revisar los criterios derivados antes de utilizarlos.
5. Esos criterios quedan disponibles para que el análisis del CV explique la compatibilidad con la oferta.

## Instrucciones de análisis

- Usa el contexto adicional proporcionado al final, pero no inventes decisiones que no estén confirmadas.
- Si falta información importante, declara supuestos y agrega preguntas abiertas al final.
- No asumas que el enlace es público, que requiere autenticación ni que existe una alternativa de carga manual; deja esa decisión como pregunta abierta cuando no esté definida.
- Distingue claramente lo que debe hacer el usuario, lo que debe mostrar la interfaz y lo que debe hacer la IA.
- Mantén la historia dentro del MVP y evita describir una implementación técnica específica salvo que sea necesaria para expresar el comportamiento.
- Considera estados de enlace vacío, formato inválido, enlace inaccesible, contenido incompleto y requisitos ambiguos.
- Define cómo se conserva la trazabilidad entre cada criterio usado por la IA y la información de la oferta que lo originó.
- No presentes la IA como infalible: debe señalar criterios no detectados, ambiguos o no verificables.
- Usa español claro, preciso y consistente con Azure DevOps.

## Formato de salida obligatorio

### Título
Un título breve y accionable.

### Historia de usuario
**Como** [rol]
**Quiero** [capacidad]
**Para** [valor de negocio]

### Alcance
Incluye el flujo cubierto y excluye explícitamente lo que queda fuera de esta historia.

### Reglas de negocio
Lista las reglas funcionales necesarias para derivar, revisar y utilizar los criterios de evaluación.

### Criterios de aceptación
Escribe entre 5 y 8 escenarios independientes en formato Gherkin en español:

**Escenario: [nombre]**
- **Dado** ...
- **Cuando** ...
- **Entonces** ...

Incluye como mínimo: enlace válido, enlace vacío o inválido, enlace inaccesible, extracción incompleta o ambigua, revisión de criterios por el reclutador y uso de los criterios en la evaluación del CV.

### Datos y campos involucrados
Tabla con las columnas: Campo, Descripción, Origen, Obligatorio, Uso en la evaluación.

### Fuera de alcance
Lista breve de exclusiones.

### Supuestos y preguntas abiertas
Separa supuestos de preguntas. Si no hay preguntas, escribe "No se identificaron preguntas abiertas".

## Contexto adicional proporcionado por el usuario
${input:contextoAdicional:Agrega aquí reglas, pantallas, restricciones o decisiones ya tomadas}
