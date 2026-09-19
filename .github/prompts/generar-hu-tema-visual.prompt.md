---
name: "Generar HU de selección de tema visual"
description: "Redacta una historia de usuario lista para Azure DevOps para permitir que el usuario elija entre el modo claro y oscuro de la aplicación."
argument-hint: "Describe decisiones, pantallas, persistencia o restricciones adicionales"
agent: "agent"
---

Actúa como Product Owner y analista funcional. Redacta una única historia de usuario concisa, lista para cargar en Azure DevOps para Talentiq. Usa lenguaje claro, evita repeticiones y no agregues detalles técnicos innecesarios.

## Contexto fijo del producto

Talentiq es un MVP para reclutadores que permite definir una vacante, cargar una oferta laboral, cargar un CV y visualizar la compatibilidad entre ambos. El estado actual se mantiene en memoria y la aplicación usa React, TypeScript y CSS. No agregues autenticación, persistencia en servidor, procesamiento masivo ni funcionalidades ajenas a la historia.

La selección entre modo claro y modo oscuro es una preferencia de presentación. No debe cambiar los datos, las reglas de evaluación, los resultados del análisis ni los permisos del usuario.

## Alcance funcional

La historia debe cubrir la selección visible y accesible entre modo claro y oscuro, su aplicación consistente en la interfaz y la conservación del trabajo en curso. No debe modificar datos, resultados, reglas de evaluación ni permisos. El comportamiento ante recarga solo debe incluirse si está confirmado.

## Instrucciones de análisis

- Usa el contexto adicional, pero no inventes decisiones.
- Incluye solo reglas necesarias para el comportamiento funcional y la accesibilidad básica del control.
- No asumas persistencia, detección automática del sistema, un tercer tema ni personalización de colores.
- Si contradice el alcance del MVP, indícalo en una única nota de riesgo.

## Formato de salida obligatorio

### Título
Un título breve y accionable.

### Historia de usuario
**Como** [rol]
**Quiero** [capacidad]
**Para** [valor de negocio]

### Alcance
Resume en un párrafo qué incluye y qué excluye la historia.

### Reglas de negocio
Lista como máximo cuatro reglas funcionales.

### Criterios de aceptación
Escribe exactamente cinco escenarios independientes y breves en formato Gherkin en español:

**Escenario: [nombre]**
- **Dado** ...
- **Cuando** ...
- **Entonces** ...

Incluye: estado inicial, selección del modo claro, selección del modo oscuro, conservación del trabajo en curso y accesibilidad. Añade el comportamiento ante recarga solo si está definido.

### Fuera de alcance
Lista breve de exclusiones: temas adicionales, personalización de colores, cambios en la lógica de evaluación y persistencia no confirmada.

### Supuestos, riesgos de alcance y preguntas abiertas
Incluye solo preguntas imprescindibles sobre persistencia, tema inicial o alcance del MVP. Si no hay preguntas, escribe "No se identificaron preguntas abiertas".

## Contexto adicional proporcionado por el usuario
${input:contextoAdicional:Agrega aquí decisiones sobre el control, vistas incluidas, persistencia, tema inicial, accesibilidad o alcance del MVP}