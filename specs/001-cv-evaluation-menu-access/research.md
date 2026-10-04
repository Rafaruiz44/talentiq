# Research: Acceso a "Evaluación de CV" desde el menú lateral

No quedaban marcadores `NEEDS CLARIFICATION` en el contexto técnico. Estas son las decisiones de diseño.

## Causa del comportamiento actual

- **Decisión**: El enlace "Evaluación de CV" de `src/App.tsx` apunta a `/puestos/<selectedPositionId>#cv-analysis` si hay un puesto seleccionado, y a `/puestos` si no.
- **Por qué importa**: `selectedPositionId` se completa al guardar un puesto (el último creado) o al abrir uno. Eso explica que se abra "el último puesto". Sin puestos, el enlace lleva a `/puestos`, que ya es la pantalla actual, y no se percibe ningún cambio.

## Decisión 1: ruta propia `/evaluacion-cv`

- **Decisión**: Nueva ruta `/evaluacion-cv` para la página de Evaluación de CV.
- **Rationale**: FR-001 exige una página propia en ambos casos. Una ruta propia permite marcar el menú como activo (FR-006), que el botón Atrás del navegador funcione y que se pueda abrir por URL.
- **Alternativas**: reutilizar `/puestos` con un aviso (se confunde con la sección Puestos y no puede activar el menú por separado); mostrar solo un aviso emergente (no abre una página, contradice FR-001).

## Decisión 2: componente nuevo y no modificar `PositionList`

- **Decisión**: Crear `CvEvaluationPositionPicker` con estados cargando, error, vacío y lista.
- **Rationale**: `PositionList` tiene texto propio ("Aún no tenés puestos", "Tus puestos") que usan las pruebas de gestión de puestos. Un componente aparte evita regresiones y permite el mensaje "Primero crea un puesto".
- **Alternativas**: parametrizar `PositionList` con textos y modo (más complejidad y más superficie de regresión).

## Decisión 3: distinguir vacío de error de carga

- **Decisión**: La vista recibe el error de carga y lo muestra con `role="alert"`. El aviso "Primero crea un puesto" solo aparece si la carga terminó sin error y la lista está vacía.
- **Rationale**: FR-007 y la regla del proyecto de no mostrar éxito simulado. Hoy `positionError` se guarda aparte de la lista, por lo que se puede combinar sin cambiar el servicio.
- **Alternativas**: mostrar siempre el aviso cuando la lista está vacía (ocultaría errores reales de red o permisos).

## Decisión 4: la selección no se hereda de `selectedPositionId`

- **Decisión**: El enlace del menú deja de depender de `selectedPositionId`. Al elegir un puesto en la vista se llama al `handleSelectPosition` existente y se navega a `/puestos/:id#cv-analysis`.
- **Rationale**: Elimina la apertura automática del último puesto (FR-004) y reutiliza el flujo actual de carga y evaluación (FR-005).
- **Alternativas**: limpiar `selectedPositionId` al guardar (afectaría la edición y el aviso de guardado).

## Decisión 5: resaltado del menú

- **Decisión**: "Evaluación de CV" está activo en `/evaluacion-cv`; "Puestos" sigue activo en `/puestos`, edición y creación. En el detalle de un puesto se mantiene activo "Puestos" como hoy, salvo que se llegue desde Evaluación de CV (ver contrato).
- **Rationale**: Hoy el detalle activa los dos enlaces a la vez, lo que confunde. Se evita sin cambiar el comportamiento de "Puestos".
- **Alternativas**: recordar el origen de la navegación (agrega estado sin necesidad para esta feature).

## Sin dependencias nuevas

No se agrega librería de routing ni de UI; se mantiene History API, como indica `AGENTS.md`.
