---
name: playwright-explore-and-test
description: "Explorar una aplicación web con Playwright y escribir pruebas E2E basadas únicamente en el DOM y snapshot de accesibilidad reales. Usar para verificar features, crear tests o diagnosticar fallos sin inventar selectores."
argument-hint: "Indicá la feature o el criterio de aceptación que querés explorar y probar."
user-invocable: true
disable-model-invocation: false
---

# Explorar y probar con Playwright

## Principio central

Primero mirar, después escribir. Nunca inventar un selector. Todo locator debe derivarse de un snapshot real o de una observación posterior de la interfaz.

## Fase 1: explorar

1. Verificar que `http://localhost:5173` responde. Si no responde, informar el bloqueo y no escribir pruebas.
2. Navegar a la aplicación con el MCP de Playwright.
3. Tomar un snapshot de accesibilidad antes de escribir cualquier selector.
4. Interactuar como un usuario: completar campos, hacer clic en controles y recorrer el flujo relevante.
5. Tomar nuevos snapshots cuando la interacción cambie la interfaz.
6. Reportar los elementos encontrados, incluyendo su rol accesible y su `data-testid` cuando exista.
7. Identificar el criterio de aceptación que valida cada flujo.

## Fase 2: escribir

1. Crear recién en esta fase los archivos dentro de `tests/`.
2. Derivar todos los locators del snapshot real obtenido en la Fase 1.
3. Preferir locators en este orden: `getByRole`, luego `getByLabel`, luego `getByTestId`.
4. No usar selectores CSS, XPath ni locators inventados.
5. No usar `waitForTimeout`; esperar condiciones observables.
6. Crear un archivo por feature.
7. Escribir una prueba por criterio de aceptación.
8. Usar títulos de pruebas en español.

## Fase 3: ejecutar

1. Ejecutar `npx playwright test --reporter=list`.
2. Si todas las pruebas pasan, informar los archivos ejecutados y el resultado.
3. Si una prueba falla, volver obligatoriamente a la Fase 1:
   - abrir o reutilizar la aplicación;
   - tomar un snapshot nuevo;
   - revisar el DOM y el estado real tras el flujo;
   - comparar la evidencia con el locator y la expectativa.
4. Antes de tocar la prueba, decir explícitamente si el problema corresponde a la aplicación o al test.
5. Si el problema es el test, modificarlo solo con locators derivados del nuevo snapshot y volver a ejecutar la Fase 3.
6. Si el problema es la aplicación, detenerse y reportar la evidencia sin modificar la prueba para ocultar el fallo.

## Criterio de finalización

La skill termina cuando las pruebas pasan o cuando se reporta con evidencia que la aplicación tiene un problema. En ningún caso se agrega un selector que no haya sido observado en la aplicación real.
