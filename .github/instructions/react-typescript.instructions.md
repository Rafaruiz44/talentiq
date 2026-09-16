---
name: "Convenciones de React y TypeScript"
description: "Convenciones para escribir y modificar componentes React y código TypeScript estricto dentro de src."
applyTo: "src/**/*.{ts,tsx}"
---

# Convenciones de React y TypeScript

- Mantener TypeScript en modo `strict` y no usar `any`.
- Definir un solo componente por archivo y exportarlo con nombre.
- Declarar las props mediante una `interface` explícita.
- Nombrar los event handlers con el patrón `handleAlgo`.
- Usar elementos HTML nativos, como `button`, `input`, `label` y `textarea`; asociar cada `label` con su control mediante `htmlFor` e `id`.
- Agregar `data-testid` en kebab-case a todo elemento interactivo.
