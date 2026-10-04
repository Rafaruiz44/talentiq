---

description: "Lista de tareas de la feature Acceso a EvaluaciÃ³n de CV desde el menÃº lateral"
---

# Tasks: Acceso a "EvaluaciÃ³n de CV" desde el menÃº lateral

**Input**: Design documents from `/specs/001-cv-evaluation-menu-access/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-routes.md, quickstart.md

**Tests**: Se incluyen pruebas Playwright porque `AGENTS.md` exige ampliar la cobertura y `quickstart.md` define los escenarios.

**Organization**: Las tareas se agrupan por historia de usuario. Las dos historias (P1) comparten `src/App.tsx` y el componente nuevo, por lo que sus tareas de implementaciÃ³n se ejecutan en orden.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Se puede ejecutar en paralelo (archivos distintos, sin dependencias)
- **[Story]**: Historia a la que pertenece (US1, US2)
- Todas las rutas son relativas a la raÃ­z del repositorio

## Phase 1: Setup

**Purpose**: Dejar el entorno listo para verificar los cambios

- [x] T001 Ejecutar `npx playwright test` y `npm run lint` para registrar la lÃ­nea base de pruebas y lint antes de modificar `src/App.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Ruta, enlace del menÃº y esqueleto de la vista, necesarios para ambas historias

**âš ï¸ CRITICAL**: Ninguna historia puede empezar hasta completar esta fase

- [x] T002 Crear `src/components/CvEvaluationPositionPicker.tsx` con export nombrado `CvEvaluationPositionPicker` y props tipadas (`positions: SavedPosition[]`, `loading: boolean`, `error: string | null`, `onCreate: () => void`, `onSelect: (positionId: string) => void`), sin `any`; por ahora solo renderiza el contenedor `section` con encabezado accesible
- [x] T003 En `src/App.tsx`, agregar `const isCvEvaluation = routePath === '/evaluacion-cv'`, el tÃ­tulo de pÃ¡gina "EvaluaciÃ³n de CV" y su subtÃ­tulo en el bloque de `page-heading`
- [x] T004 En `src/App.tsx`, cambiar el enlace "EvaluaciÃ³n de CV" del menÃº a `href="/evaluacion-cv"` con `preventDefault` y `navigate('/evaluacion-cv')`, eliminando la dependencia de `selectedPositionId`
- [x] T005 En `src/App.tsx`, ajustar `sidebar-link-active`: "EvaluaciÃ³n de CV" activo solo si `isCvEvaluation`; "Puestos" activo en lista, creaciÃ³n, ediciÃ³n y detalle, pero no en `/evaluacion-cv`
- [x] T006 En `src/App.tsx`, renderizar `<CvEvaluationPositionPicker />` cuando `isCvEvaluation`, pasando `positions`, `loading`, `error`, `onCreate={handleNewPosition}` y `onSelect` (esta Ãºltima se completa en T012)

**Checkpoint**: `/evaluacion-cv` carga dentro del shell autenticado y el menÃº queda marcado correctamente

---

## Phase 3: User Story 1 - Entrar a EvaluaciÃ³n de CV sin puestos creados (Priority: P1) ðŸŽ¯ MVP

**Goal**: Con una cuenta sin puestos, "EvaluaciÃ³n de CV" abre su pÃ¡gina con el aviso "Primero crea un puesto" y un acceso para crear uno.

**Independent Test**: Con `mockAuthenticatedSession(page)` sin puestos, hacer clic en "EvaluaciÃ³n de CV" y comprobar URL, aviso, botÃ³n de crear y menÃº activo.

### Tests for User Story 1

- [x] T007 [P] [US1] Crear `tests/evaluacion-cv-menu.spec.ts` con la prueba "sin puestos": clic en "EvaluaciÃ³n de CV", URL `/evaluacion-cv`, `cv-evaluation-no-positions` visible con el texto "Primero crea un puesto", enlace del menÃº activo (`aria-current` o clase activa) y clic en `cv-evaluation-create-position` lleva a `/puestos/nuevo`
- [x] T008 [P] [US1] En `tests/evaluacion-cv-menu.spec.ts`, agregar la prueba "error de carga": simular `**/rest/v1/positions?*` con estado 500 y comprobar que `cv-evaluation-error` es visible y `cv-evaluation-no-positions` no aparece
- [x] T009 [P] [US1] En `tests/evaluacion-cv-menu.spec.ts`, agregar la prueba "carga en curso": retrasar la respuesta de puestos y comprobar que `cv-evaluation-loading` es visible y `cv-evaluation-no-positions` no aparece hasta que responde

### Implementation for User Story 1

- [x] T010 [US1] En `src/components/CvEvaluationPositionPicker.tsx`, implementar los estados cargando (`role="status"`, `data-testid="cv-evaluation-loading"`), error (`role="alert"`, `data-testid="cv-evaluation-error"`) y sin puestos (`data-testid="cv-evaluation-no-positions"` con el mensaje "Primero crea un puesto" y un `button` nativo `data-testid="cv-evaluation-create-position"` que llama a `onCreate`), con prioridad cargando > error > sin puestos
- [x] T011 [US1] En `src/App.tsx`, calcular `loading` como `positionsLoadedForUserId !== session.user.id` y pasar `positionError` como `error` al componente, para que el aviso de "sin puestos" solo aparezca con carga terminada y sin error

**Checkpoint**: La historia 1 funciona y se prueba por sÃ­ sola

---

## Phase 4: User Story 2 - Entrar a EvaluaciÃ³n de CV con puestos creados (Priority: P1)

**Goal**: Con puestos creados, "EvaluaciÃ³n de CV" abre la pÃ¡gina con la lista de puestos y no abre ninguno automÃ¡ticamente.

**Independent Test**: Con varios puestos simulados, hacer clic en "EvaluaciÃ³n de CV" y comprobar que se ve la lista, que no aparece `position-detail`, y que elegir un puesto abre su `analysis-workspace`.

### Tests for User Story 2

- [x] T012 [P] [US2] En `tests/evaluacion-cv-menu.spec.ts`, agregar la prueba "con varios puestos": clic en "EvaluaciÃ³n de CV", URL `/evaluacion-cv`, `cv-evaluation-position-list` visible con todos los puestos y `position-detail` con conteo 0
- [x] T013 [P] [US2] En `tests/evaluacion-cv-menu.spec.ts`, agregar la prueba "elegir un puesto": elegir un puesto que no sea el mÃ¡s reciente con `cv-evaluation-select-position` y comprobar URL `/puestos/<id>#cv-analysis`, `position-detail` y `analysis-workspace` visibles
- [x] T014 [P] [US2] En `tests/evaluacion-cv-menu.spec.ts`, agregar la prueba "el Ãºltimo puesto no se abre solo": crear un puesto con `save-position`, volver a hacer clic en "EvaluaciÃ³n de CV" y comprobar que se ve la lista y no `position-detail`

### Implementation for User Story 2

- [x] T015 [US2] En `src/components/CvEvaluationPositionPicker.tsx`, implementar el estado con puestos: `section` con `data-testid="cv-evaluation-position-list"`, tabla semÃ¡ntica con encabezados (Puesto, Seniority, Habilidades, Estado) reutilizando las clases `position-table` y `status-badge` existentes, y por fila un `button` nativo `data-testid="cv-evaluation-select-position"` con nombre accesible `Evaluar CVs para <tÃ­tulo>` que llama a `onSelect(position.id)`
- [x] T016 [US2] En `src/App.tsx`, conectar `onSelect` al `handleSelectPosition` existente y hacer que navegue a `/puestos/${encodeURIComponent(id)}#cv-analysis` (hoy navega solo a `/puestos/:id`), manteniendo sin cambios el flujo desde la secciÃ³n Puestos

**Checkpoint**: Las historias 1 y 2 funcionan; ningÃºn clic en el menÃº abre un puesto sin elecciÃ³n

---

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T017 Ejecutar `npx playwright test` completo y comprobar que `tests/positions.spec.ts`, `tests/analisis-cv.spec.ts`, `tests/definicion-puesto.spec.ts` y `tests/auth.spec.ts` siguen pasando
- [x] T018 [P] Ejecutar `npm run lint` y `npm run build` y corregir advertencias de TypeScript estricto o de oxlint en `src/App.tsx` y `src/components/CvEvaluationPositionPicker.tsx`
- [x] T019 [P] Revisar en la app real el flujo de `quickstart.md` (validaciÃ³n manual) en tema claro y oscuro y en ancho mÃ³vil, sin desbordamiento horizontal
- [x] T020 [P] Actualizar la secciÃ³n "Estado actual implementado" y la guÃ­a de navegaciÃ³n de `PROJECT_CONTEXT.md` con la ruta `/evaluacion-cv` y el nuevo componente

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias
- **Foundational (Phase 2)**: depende de Setup; bloquea las historias
- **US1 (Phase 3)** y **US2 (Phase 4)**: dependen de Foundational. Comparten archivos, por lo que se implementan en orden (US1 y luego US2); sus tareas de prueba sÃ­ se pueden escribir en paralelo
- **Polish (Phase 5)**: depende de ambas historias

### Within Each User Story

- Escribir las pruebas primero y verificar que fallan
- Componente antes que la integraciÃ³n en `App.tsx`

### Parallel Opportunities

- T007, T008 y T009 (mismo archivo de pruebas, escritas por separado antes de integrar)
- T012, T013 y T014
- T018, T019 y T020 en Polish

## Parallel Example: User Story 1

```text
Task: "Prueba sin puestos en tests/evaluacion-cv-menu.spec.ts"
Task: "Prueba de error de carga en tests/evaluacion-cv-menu.spec.ts"
Task: "Prueba de carga en curso en tests/evaluacion-cv-menu.spec.ts"
```

## Implementation Strategy

### MVP First (User Story 1)

1. Completar Phase 1 y Phase 2
2. Completar Phase 3 (aviso "Primero crea un puesto")
3. **Detenerse y validar** la historia 1 con sus pruebas
4. Continuar con Phase 4

### Incremental Delivery

1. Setup y Foundational: la ruta y el menÃº ya no abren un puesto por sÃ­ solos
2. Historia 1: cuentas nuevas reciben guÃ­a
3. Historia 2: cuentas con puestos eligen con cuÃ¡l trabajar
4. Polish: regresiÃ³n completa y documentaciÃ³n

## Notes

- No se instalan dependencias ni se cambia el backend ni el esquema de base de datos
- Seguir `AGENTS.md`: sin `any`, un componente por archivo, HTML nativo y `data-testid` en kebab-case
- Confirmar con el usuario antes de crear work items en Azure DevOps
