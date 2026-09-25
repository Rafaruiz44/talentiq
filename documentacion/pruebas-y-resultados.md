# Pruebas y resultados

**Trabajo práctico:** Inteligencia Artificial Aplicada  
**Entrega:** MVP  
**Grupo:** 2  
**Institución:** Universidad Nacional de La Matanza  
**Carrera y período:** Ingeniería en Informática, 2026, segundo cuatrimestre  
**Fecha de ejecución:** 25 de septiembre de 2026

## Resumen ejecutivo

Se ejecutaron lint, build y las pruebas end-to-end. Las tres validaciones finalizaron con código de salida 0. La suite Playwright ejecutó siete pruebas y las siete pasaron. En una primera ejecución se encontraron desalineaciones entre los tests y la interfaz actual; se corrigieron las pruebas para reflejar los controles y el comportamiento observados.

| Validación | Comando | Resultado |
|---|---|---|
| Lint | `npm run lint` | Aprobado, código de salida 0 |
| Compilación TypeScript y Vite | `npm run build` | Aprobada, código de salida 0; Vite emitió una advertencia de tamaño de bundle |
| Pruebas E2E | `npx playwright test --reporter=list` | 7 ejecutadas y aprobadas; código de salida 0 |

## Entorno

- Sistema operativo: Windows.
- Node.js: v24.19.0.
- npm: 11.17.0.
- Navegador del proyecto Playwright: Chromium.
- Ejecución local; Talentiq todavía no tiene una demo desplegada.

## Alcance de las pruebas existentes

Los archivos de Playwright cubren la definición de requisitos del puesto, la ponderación de habilidades, la carga de un PDF, el resultado de un análisis y el cambio de tema.

### Casos aprobados

| Caso | Resultado |
|---|---|
| Mantener deshabilitado el análisis hasta completar los datos requeridos | Aprobado |
| Agregar una habilidad con su peso individual | Aprobado |
| Modificar el peso de una habilidad existente | Aprobado |
| Seleccionar un archivo PDF desde la zona de carga | Aprobado |
| Calcular y mostrar la compatibilidad y el veredicto | Aprobado |
| Mostrar el desglose de fortalezas y brechas | Aprobado |
| Cambiar entre tema claro y oscuro y conservar la preferencia durante la sesión | Aprobado |

Los dos casos de análisis cargan un PDF válido de prueba. La respuesta de Azure OpenAI se intercepta con una respuesta determinista para que las pruebas no dependan de credenciales, red o variabilidad del modelo.

### Hallazgos de la primera ejecución y resolución

| Hallazgo inicial | Resolución |
|---|---|---|
| Dos pruebas buscaban un campo accesible llamado `Rol`, que ya no existe en la interfaz. | Se actualizaron para completar el puesto, agregar habilidades individualmente y seleccionar el seniority mediante los controles actuales. |
| Una prueba intentaba pulsar `Procesar análisis` vacío, aunque la interfaz lo mantiene deshabilitado. | Se cambió el criterio para verificar que el botón siga deshabilitado mientras falten datos requeridos. |

## Detalle de ejecución

### Lint

Se ejecutó `npm run lint`. Oxlint terminó sin reportar errores y devolvió código de salida 0.

### Build

Se ejecutó `npm run build`, que invoca `tsc -b` y luego `vite build`. Ambos pasos finalizaron correctamente con código de salida 0.

Vite mostró una advertencia: hay chunks superiores a 500 kB después de minificar. En esta ejecución, el bundle JavaScript principal fue de aproximadamente 669 kB y el worker PDF de aproximadamente 1.265 kB. Es una advertencia de tamaño, no un fallo de compilación.

### Playwright

Se ejecutó `npx playwright test --reporter=list`. Playwright lanzó siete casos en Chromium usando dos workers. El resultado final fue siete aprobados en aproximadamente 5,6 segundos. Las pruebas de análisis usan un PDF válido generado en memoria y simulan la respuesta de Azure OpenAI cuando la aplicación intenta realizar una llamada externa.

## Cobertura no verificada

- La integración real con Azure OpenAI no se comprobó en esta ejecución: las llamadas de los E2E se simulan. No se inspeccionaron credenciales ni valores de `.env`.
- No se probaron despliegue, rendimiento con grandes volúmenes, seguridad de producción ni compatibilidad con proveedores de Azure.
- No se verificó OCR para PDF escaneados o documentos sin texto seleccionable.
- No hay pruebas automatizadas de base de datos, banco de talentos, carga masiva o generación de preguntas de entrevista porque esas funciones no forman parte del MVP actual.
- No se realizó una prueba manual independiente en un navegador ni se probó una demo pública.

## Próximas acciones recomendadas

- Probar Azure OpenAI de forma aislada con una configuración de desarrollo segura, además de las pruebas E2E simuladas.
- Evaluar la reducción o división del bundle PDF si el tamaño de descarga afecta la experiencia.

## Trazabilidad

Los comandos y resultados de este informe corresponden a la ejecución local realizada el 25 de septiembre de 2026. Los comandos disponibles se definen en `package.json`; la configuración de navegador y servidor de pruebas está en `playwright.config.ts`; los escenarios se encuentran en `tests/analisis-cv.spec.ts` y `tests/definicion-puesto.spec.ts`.