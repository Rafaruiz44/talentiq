# Implementation Plan: Acceso a "Evaluación de CV" desde el menú lateral

**Branch**: `feature/spec-kit` (el script reportó `001-cv-evaluation-menu-access` solo como nombre de feature) | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-cv-evaluation-menu-access/spec.md`

## Summary

La opción "Evaluación de CV" hoy es un enlace al último puesto seleccionado o guardado (`selectedPositionId`), o a `/puestos` si no hay ninguno. Por eso, sin puestos parece no hacer nada y, con puestos, abre uno que la persona no eligió.

Se agrega una ruta propia `/evaluacion-cv`, con una vista que muestra tres estados explícitos: cargando, error de carga o sin puestos ("Primero crea un puesto" con botón para crear), y lista de puestos para elegir. El enlace del menú navega siempre a esa ruta y se marca activo en ella. Al elegir un puesto se abre `/puestos/:id#cv-analysis`, el flujo existente de carga y evaluación. No cambia el modelo de datos, el backend ni la evaluación.

## Technical Context

**Language/Version**: TypeScript 6 (modo estricto), React 19.2

**Primary Dependencies**: Vite 8, `@supabase/supabase-js` 2.x; sin dependencias nuevas (no se agrega librería de routing)

**Storage**: Supabase, tabla `positions` existente, solo lectura vía `listSavedPositions`; sin cambios de esquema

**Testing**: Playwright (`tests/`), con respuestas de Supabase simuladas mediante `mockAuthenticatedSession` de `tests/fixtures.ts`

**Target Platform**: Navegador web, escritorio y móvil (sidebar adaptable)

**Project Type**: Aplicación web de una sola página, frontend Vite + React

**Performance Goals**: Sin objetivo propio; reutiliza la lista de puestos ya cargada al iniciar sesión

**Constraints**: Navegación con History API; HTML nativo; sin `any`; un componente por archivo con export nombrado; `data-testid` en kebab-case; errores explícitos, sin éxito simulado

**Scale/Scope**: Una ruta nueva, un componente nuevo, un cambio en el menú y su resaltado activo

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` sigue siendo la plantilla sin completar, por lo que no define gates. Las reglas vigentes del proyecto están en `AGENTS.md` y `.github/instructions/estilo-ui.instructions.md`, y se usan como gates:

| Regla | Resultado |
|---|---|
| Sin `any`, TypeScript estricto | Cumple |
| Un componente por archivo con export nombrado | Cumple (`CvEvaluationPositionPicker`) |
| Elementos HTML nativos, sin `div` con `onClick` | Cumple |
| `data-testid` kebab-case para pruebas | Cumple |
| No instalar dependencias | Cumple (ninguna nueva) |
| Aislamiento por reclutador en el servidor | Cumple (sin cambios; la lista ya filtra por `recruiter_id` con RLS) |
| Informar errores explícitamente, sin éxito simulado | Cumple (FR-007 distingue vacío de error) |
| Estados de carga, vacío y error explícitos (UI) | Cumple |
| Ampliar pruebas | Cumple (ver `quickstart.md`) |
| Preservar el modelo de dominio | Cumple (sin cambios) |

Re-evaluación posterior al diseño: sin violaciones. No hace falta la tabla de Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-cv-evaluation-menu-access/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-routes.md
└── tasks.md             # Lo crea /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── App.tsx                                    # Ruta /evaluacion-cv, enlace y resaltado del menú
└── components/
    ├── CvEvaluationPositionPicker.tsx         # Nuevo: estados cargando/error/vacío/lista
    └── PositionList.tsx                       # Sin cambios

tests/
└── evaluacion-cv-menu.spec.ts                 # Nuevo: escenarios de las dos historias
```

**Structure Decision**: Se mantiene la estructura existente de una sola app Vite con `src/components`. Se agrega un único componente nuevo para la vista y los estilos se reutilizan de `index.css`/`App.css` (clases de lista, tabla y estado vacío ya existentes), sin cambiar el diseño.

## Complexity Tracking

Sin violaciones; no aplica.
