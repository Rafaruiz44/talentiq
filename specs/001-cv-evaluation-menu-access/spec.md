# Feature Specification: Acceso a "Evaluación de CV" desde el menú lateral

**Feature Branch**: `feature/spec-kit` (no se creó una rama nueva; no hay hook de git registrado)

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "Cuando clickeas del side menu la opcion 'Evaluación de CV' si no hay puestos creados no te lleva a ningun lado. Te debería abrir la pagina igual y mostrarse un cartel con un mensaje parecido a 'Primero crea un puesto'. Despues, al clickear el mismo boton 'Evaluación de CV' si ya hay puestos, te abre directamente la intefaz del último puesto creado. No debería ser así."

## Clarifications

### Session 2026-10-04

- Q: Cuando ya hay puestos creados y se hace clic en "Evaluación de CV", ¿qué debe mostrar la página? → A: Una lista de los puestos de la reclutadora para elegir con cuál evaluar CVs.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrar a Evaluación de CV sin puestos creados (Priority: P1)

Una reclutadora que todavía no creó ningún puesto hace clic en "Evaluación de CV" en el menú lateral. Hoy no pasa nada visible. Debe abrirse la página de Evaluación de CV y mostrarse un aviso claro que le indique que primero tiene que crear un puesto, con un camino directo para hacerlo.

**Why this priority**: Hoy la opción parece rota para quien recién empieza. Es el primer contacto de una cuenta nueva con la evaluación y no ofrece ninguna guía.

**Independent Test**: Con una cuenta sin puestos, hacer clic en "Evaluación de CV" y comprobar que se abre su página con el mensaje "Primero crea un puesto" y un acceso para crear uno.

**Acceptance Scenarios**:

1. **Given** una cuenta autenticada sin puestos, **When** hace clic en "Evaluación de CV", **Then** se abre la página de Evaluación de CV y se muestra un aviso con el mensaje "Primero crea un puesto".
2. **Given** el aviso visible, **When** la reclutadora usa el acceso para crear un puesto, **Then** llega al flujo de creación de puesto.
3. **Given** una cuenta sin puestos, **When** está en la página de Evaluación de CV, **Then** la opción "Evaluación de CV" figura como la sección activa del menú.

---

### User Story 2 - Entrar a Evaluación de CV con puestos creados (Priority: P1)

Una reclutadora con uno o más puestos hace clic en "Evaluación de CV". Hoy el sistema la lleva directamente al último puesto creado, aunque ella no lo haya elegido. Debe abrirse la página de Evaluación de CV sin dar por elegido ningún puesto, y ser ella quien decide con cuál trabajar.

**Why this priority**: Abrir un puesto que la persona no eligió puede llevarla a cargar y evaluar CVs contra el puesto equivocado.

**Independent Test**: Con una cuenta con varios puestos, hacer clic en "Evaluación de CV" y comprobar que se abre la página de Evaluación de CV sin entrar a la interfaz de ningún puesto, y que se puede elegir cualquiera de ellos.

**Acceptance Scenarios**:

1. **Given** una cuenta con uno o más puestos, **When** hace clic en "Evaluación de CV", **Then** se abre la página de Evaluación de CV y no se abre automáticamente la interfaz de ningún puesto.
2. **Given** la página de Evaluación de CV con puestos disponibles, **When** la reclutadora ve la página, **Then** se muestra una lista de sus puestos para elegir.
3. **Given** la lista de puestos, **When** la reclutadora elige un puesto, **Then** accede a la carga y evaluación de CVs para ese puesto.
4. **Given** una cuenta que creó varios puestos, **When** abre "Evaluación de CV", **Then** el último puesto creado no tiene un tratamiento preferente frente a los demás.

---

### Edge Cases

- ¿Qué pasa mientras se cargan los puestos de la cuenta? La página no debe mostrar el aviso "Primero crea un puesto" hasta saber con certeza que no hay puestos.
- ¿Qué pasa si falla la carga de los puestos? Se debe informar el error de forma explícita, sin mostrar "Primero crea un puesto" como si la cuenta estuviera vacía.
- ¿Qué pasa si la reclutadora ya estaba viendo un puesto y vuelve a hacer clic en "Evaluación de CV"? Se aplica el mismo comportamiento: se abre la página de Evaluación de CV sin un puesto elegido de antemano.
- ¿Qué pasa si la reclutadora crea su primer puesto desde el aviso y regresa a "Evaluación de CV"? El aviso ya no aparece y se muestran sus puestos para elegir.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La opción "Evaluación de CV" del menú lateral MUST abrir siempre su propia página, tanto si la cuenta tiene puestos como si no.
- **FR-002**: Si la cuenta no tiene puestos, la página MUST mostrar un aviso con un mensaje equivalente a "Primero crea un puesto".
- **FR-003**: El aviso de ausencia de puestos MUST incluir un acceso directo al flujo de creación de puestos.
- **FR-004**: Si la cuenta tiene puestos, la página MUST mostrar una lista de los puestos de la reclutadora para elegir con cuál trabajar, y NO MUST abrir automáticamente el último puesto creado ni ningún otro.
- **FR-005**: Al elegir un puesto, la persona MUST poder acceder a la carga y evaluación de CVs de ese puesto.
- **FR-006**: La opción "Evaluación de CV" MUST mostrarse como activa mientras se está en su página.
- **FR-007**: El sistema MUST distinguir entre "la cuenta no tiene puestos" y "no se pudieron cargar los puestos", y MUST informar el error de carga de forma explícita en el segundo caso.
- **FR-008**: La página MUST mostrar únicamente los puestos del reclutador autenticado.

### Key Entities

- **Puesto**: posición que pertenece a un reclutador autenticado. Determina si se muestra el aviso o la selección.
- **Reclutador**: persona autenticada; solo ve sus propios puestos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En una cuenta sin puestos, el 100 % de los clics en "Evaluación de CV" muestra el aviso "Primero crea un puesto" en la página, sin quedarse en la pantalla anterior.
- **SC-002**: En una cuenta con puestos, el 0 % de los clics en "Evaluación de CV" abre automáticamente la interfaz de un puesto.
- **SC-003**: Una reclutadora puede pasar del aviso a empezar a crear su primer puesto en un solo clic.
- **SC-004**: Una reclutadora con puestos puede elegir el que quiere evaluar en no más de dos clics desde el menú.

## Assumptions

- "Último puesto creado" se refiere al comportamiento actual de abrir directamente un puesto sin que la persona lo elija.
- El resto del flujo de un puesto (carga de CV, evaluación) no cambia.
- La opción "Puestos" del menú conserva su comportamiento actual.
- El alcance es la navegación y los avisos de esta opción; no incluye cambios en estados, etapas ni persistencia de candidatos.
