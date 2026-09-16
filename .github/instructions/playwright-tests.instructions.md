---
name: "Convenciones de pruebas Playwright"
description: "Convenciones para escribir pruebas E2E de Playwright en tests/**/*.spec.ts."
applyTo: "tests/**/*.spec.ts"
---

# Convenciones de pruebas Playwright

- Preferir locators en este orden: `getByRole`, luego `getByLabel`, luego `getByTestId`.
- No usar selectores CSS ni XPath.
- No usar `waitForTimeout`; esperar condiciones observables o estados relevantes.
- Escribir una prueba por criterio de aceptación.
- Redactar los títulos de las pruebas en español.
