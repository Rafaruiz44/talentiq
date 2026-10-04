# Quickstart: validar el acceso a "Evaluación de CV"

## Requisitos previos

- Dependencias instaladas (`npm install`) y variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` configuradas, o las de prueba que usa Playwright.
- Datos y contratos: ver [data-model.md](data-model.md) y [contracts/ui-routes.md](contracts/ui-routes.md).

## Validación automatizada

Las pruebas usan `mockAuthenticatedSession` de `tests/fixtures.ts` con y sin puestos simulados. Se agregan en `tests/evaluacion-cv-menu.spec.ts`:

1. **Sin puestos**: clic en "Evaluación de CV" → URL `/evaluacion-cv`, aviso "Primero crea un puesto" visible, el menú activo es "Evaluación de CV", y el botón de crear lleva a `/puestos/nuevo`.
2. **Con varios puestos**: clic en "Evaluación de CV" → URL `/evaluacion-cv`, lista de puestos visible y `position-detail` ausente (no se abre ningún puesto).
3. **Elegir un puesto**: desde la lista, elegir uno cualquiera → se abre su detalle con `analysis-workspace`.
4. **Último puesto sin trato preferente**: tras crear o guardar un puesto, volver a hacer clic en "Evaluación de CV" no abre su detalle.
5. **Error de carga**: si la consulta de puestos falla, se muestra el error y no el aviso "Primero crea un puesto".
6. **Carga en curso**: mientras la consulta no responde, no aparece el aviso de ausencia de puestos.

Ejecución: `npx playwright test tests/evaluacion-cv-menu.spec.ts`, y luego la suite completa con `npx playwright test` para confirmar que las pruebas de puestos y análisis de CV no se rompen.

## Validación manual

1. `npm run dev` y abrir `http://localhost:5173/`.
2. Con una cuenta sin puestos: clic en "Evaluación de CV" y comprobar el aviso y el botón para crear.
3. Crear un puesto y volver a hacer clic en "Evaluación de CV": debe verse la lista, no el detalle.
4. Elegir un puesto de la lista y comprobar que se abre su carga de CV.
