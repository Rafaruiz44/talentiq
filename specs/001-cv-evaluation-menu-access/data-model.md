# Data Model: Acceso a "Evaluación de CV" desde el menú lateral

La feature no crea ni modifica datos persistentes: no hay migraciones ni cambios de esquema. Solo lee los puestos del reclutador autenticado, que ya expone `listSavedPositions`.

## Entidades existentes usadas

### Puesto (`SavedPosition`, `src/services/positions.ts`)

| Campo | Uso en esta feature |
|---|---|
| `id` | Identificador para navegar a `/puestos/:id#cv-analysis` |
| `title` | Nombre visible en la lista |
| `requirements.seniority` | Columna de la lista |
| `requirements.skills` | Cantidad de habilidades en la lista |
| `status` | Badge de estado (`Nueva`, `Abierta`, `Cubierta`, `Cancelada`) |

Pertenece a un reclutador (`recruiter_id`); la política RLS existente garantiza que solo se lean los propios (FR-008).

## Estado de interfaz de la vista

Estado derivado de datos ya presentes en `App`; no se persiste.

| Estado | Condición | Contenido |
|---|---|---|
| Cargando | Los puestos del usuario aún no terminaron de cargar | Mensaje de carga con `role="status"` |
| Error | La carga terminó con error | Mensaje de error con `role="alert"`, sin aviso de "crear puesto" |
| Sin puestos | Carga correcta y lista vacía | "Primero crea un puesto" y botón para crear |
| Con puestos | Carga correcta y lista no vacía | Lista de puestos para elegir |

Transiciones: Cargando → (Error | Sin puestos | Con puestos). Crear un puesto y volver lleva de Sin puestos a Con puestos.

## Reglas de validación

- El aviso "Primero crea un puesto" solo se muestra en el estado Sin puestos (FR-002, FR-007).
- Ningún estado selecciona un puesto automáticamente (FR-004).
