# Contrato de interfaz: rutas y vista de Evaluación de CV

La aplicación no expone una API nueva. Los contratos son las rutas de navegación y los elementos de la vista, que las pruebas verifican.

## Rutas

| Ruta | Vista | Menú activo |
|---|---|---|
| `/puestos` | Listado de puestos (sin cambios) | Puestos |
| `/puestos/nuevo` | Creación de puesto (sin cambios) | Puestos |
| `/puestos/:id` | Detalle, carga y evaluación de CV (sin cambios) | Puestos |
| `/puestos/:id/editar` | Edición (sin cambios) | Puestos |
| `/evaluacion-cv` | **Nueva**: elegir un puesto para evaluar CVs | Evaluación de CV |

## Menú lateral

- El enlace "Evaluación de CV" tiene `href="/evaluacion-cv"` y navega siempre a esa ruta, sin depender de qué puesto se vio o guardó antes.
- Mantiene el patrón actual: `preventDefault` y navegación con History API.

## Vista `/evaluacion-cv`

El título de la página es "Evaluación de CV".

| Estado | Elementos | `data-testid` |
|---|---|---|
| Cargando | Mensaje "Cargando puestos..." con `role="status"` | `cv-evaluation-loading` |
| Error | Mensaje con `role="alert"` | `cv-evaluation-error` |
| Sin puestos | Aviso "Primero crea un puesto" y botón "Crear puesto" | `cv-evaluation-no-positions`, `cv-evaluation-create-position` |
| Con puestos | Lista de puestos con un botón por puesto para elegirlo | `cv-evaluation-position-list`, `cv-evaluation-select-position` |

### Acciones

- **Crear puesto**: navega a `/puestos/nuevo`.
- **Elegir puesto**: navega a `/puestos/:id#cv-analysis`.

### Garantías

- Ningún estado abre el detalle de un puesto sin una acción explícita de la persona.
- En el estado Error nunca aparece el aviso "Primero crea un puesto".
