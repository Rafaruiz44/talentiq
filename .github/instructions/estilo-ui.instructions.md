---
name: "Estilo de interfaz Talentiq"
description: "Sistema visual Modern SaaS minimalista para las interfaces React y estilos CSS de Talentiq."
applyTo: "src/**/*.{ts,tsx,css}"
---

# Estilo de interfaz Talentiq

Aplicá estas reglas al crear o modificar la interfaz. Revisá la pantalla y las variables existentes antes de cambiarlas; preservá el comportamiento y evitá rediseños fuera del alcance del pedido.

## Dirección visual

- Modern SaaS / Minimalist UI: interfaz clara, profesional, calmada y centrada en el contenido.
- Usá fondos y superficies neutrales, buena jerarquía tipográfica y espacio en blanco generoso.
- Preferí bordes ligeramente redondeados y sombras sutiles; evitá gradientes, efectos decorativos fuertes y exceso de contenedores.
- Conservá una tipografía moderna del sistema o la que ya exista en el proyecto. No cargues fuentes externas.
- Mantené un solo color principal para las acciones prioritarias. Los enlaces y botones primarios deben compartirlo; no conviertas todos los elementos en acciones primarias.
- Los colores de estado son semánticos y discretos: comunican éxito, advertencia o error sin competir con el color de acción.
- Respetá los temas claro y oscuro ya existentes, y verificá contraste suficiente en ambos.

## Patrones de producto

- En una aplicación con varias áreas, usá una estructura de navegación con sidebar; en pantallas estrechas, transformala en navegación compacta sin perder acceso a las secciones.
- Mantené el dashboard limpio. Mostrá cards de métricas solo cuando los datos provengan de información real del sistema; nunca inventes cifras ni tendencias.
- Para listas de candidatos, usá tablas legibles con encabezados y columnas priorizadas. En móvil, permití una presentación alternativa utilizable en vez de comprimir ilegiblemente la tabla.
- Agrupá búsqueda y filtros junto a la lista. Los filtros avanzados deben poder abrirse, cerrarse y entenderse con claridad.
- Representá estados con badges compactos y de apariencia consistente.
- Usá Kanban para procesos por etapas cuando ayude a mover y comprender solicitudes; cada etapa debe tener un nombre accesible y una alternativa usable con teclado y pantallas pequeñas.
- Comunicá estados de carga, vacío y error explícitamente. No sustituyas errores por datos vacíos o contenido simulado.

## Interacción, accesibilidad y consistencia

- Preferí HTML semántico y controles nativos; cada campo debe tener un label y cada acción un nombre accesible.
- La UI debe funcionar con teclado, mostrar foco visible y no depender solo del color para expresar un estado.
- Conservá patrones, tokens y componentes existentes; extraé un patrón compartido solo cuando se use más de una vez.
- Aplicá diseño responsivo y evita desbordamiento horizontal en los tamaños relevantes.
- Agregá o actualizá `data-testid` kebab-case cuando sea necesario para las pruebas; no uses test IDs como sustituto de accesibilidad.
- No agregues dependencias, datos de ejemplo presentados como reales ni cambios de negocio para completar el aspecto visual.
