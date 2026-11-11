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
## Validación de la evaluación de habilidades (11 de noviembre de 2026)

### Problema detectado

Una revisión del código mostró que el puntaje de cada habilidad no dependía del criterio de la IA sino de una búsqueda de texto literal. El cliente generaba una fortaleza por cada habilidad del puesto, conservaba solo las que aparecían escritas en el CV y recortaba la lista a cuatro; el servidor sumaba puntos si el nombre de la habilidad aparecía como fragmento de una fortaleza. En consecuencia:

- No se reconocían sinónimos ni variantes (`csharp`/`C#`, `English`/`Inglés`, `React JS`/`React`).
- Se otorgaban puntos indebidos por coincidencias de texto: `Java` por `JavaScript`, `REST` por el apellido `Restrepo`, `TypeScript` por la palabra `Scripts`, o una habilidad mencionada solo como objetivo de aprendizaje.
- En puestos con más de cuatro habilidades, las restantes nunca sumaban.
- Una heurística del cliente mostraba "Seniority no acreditado" aun cuando el puntaje sí lo otorgaba.

### Solución (`candidate-evaluation-v21`)

- Azure OpenAI devuelve `skillAssessments`: una decisión `met` con evidencia por cada habilidad del puesto. El prompt define el criterio (sinónimos, abreviaturas, idiomas y herramientas que implican la habilidad cuentan; objetivos de aprendizaje y tecnologías distintas de nombre parecido no) sin listas de alias por profesión.
- El servidor calcula el puntaje solo con esas decisiones y con `seniorityMatchesRole`, construye fortalezas y brechas a partir de los mismos datos y falla explícitamente si la IA omite alguna habilidad.
- Se eliminó el recálculo por texto del cliente.
- El prompt fija una regla de compatibilidad de área para el seniority: se decide por el cargo y las tareas principales, no por las herramientas compartidas.
- El modelo desplegado no acepta `temperature` distinto de 1, por lo que la estabilidad entre corridas depende de las reglas del prompt.

### Pruebas automatizadas sin IA

- Arnés que ejecuta el código real del cliente y del servidor con Azure y Supabase simulados, con una IA que responde siempre correctamente, sobre 10 casos (sinónimos, trampas de texto, puesto con 7 habilidades, seniority): antes del cambio 2 de 10 casos daban el puntaje esperado; después, 10 de 10.
- `npm run test:server`: 28 pruebas aprobadas, incluidas 6 nuevas que cubren cada problema detectado.
- Playwright, ejecutado con el Chrome instalado en el equipo porque no se pudo descargar el navegador de Playwright: 22 de 25 aprobadas. Se corrigieron mocks desactualizados de `/api/evaluation-runs`, que no devolvían puntaje ni veredicto. Las 3 pruebas restantes fallan igual con el código anterior al cambio y no involucran el cálculo del puntaje.

### Pruebas con Azure OpenAI real

Se ejecutó el servidor real contra Azure con Supabase simulado (sin escrituras en la base), sobre casos de desarrollo de software con resultado esperado por habilidad.

| Ejecución | Llamadas | Habilidades correctas | Seniority correcto |
|---|---|---|---|
| v20: 13 casos × 3 corridas | 39 | 105/105 | 36/39 |
| v21: 4 casos límite de seniority × 3 corridas | 12 | 24/24 | 12/12 |

En v20 las decisiones de habilidades fueron idénticas entre corridas; los 3 desvíos fueron de compatibilidad de área en el seniority y desaparecieron con la regla agregada en v21.

### Prueba manual en la aplicación (otros rubros)

Se cargaron 3 puestos y 5 CVs ficticios en PDF y se compararon las 15 combinaciones con el resultado esperado, calculado previamente con las reglas del sistema.

**Puestos**

1. Analista Contable Junior: Junior (peso 8), mínimo 75 %. Habilidades: Liquidación de impuestos (IVA y Ganancias) 8, Tango Gestión 7, Conciliaciones bancarias 6, Liquidación de sueldos 5, Excel 4, Power BI 2. Total 40.
2. Encargado/a de Depósito: Semi Senior (peso 10), mínimo 60 %. Habilidades: Gestión de inventarios 9, WMS 7, Manejo de autoelevador 6, Liderazgo de equipos 5, Normas de seguridad e higiene 3. Total 40.
3. Asistente de Marketing Trainee: Trainee (peso 4), mínimo 70 %. Habilidades: Gestión de redes sociales 6, Canva 4, Google Analytics 3, Copywriting 3. Total 20.

**CVs**

- Mariana Ledesma: asistente contable desde marzo de 2024. Liquida IVA y Ganancias, hace conciliaciones y "payroll", usa SAP Business One (no Tango) y Excel; "quiere aprender Power BI".
- Ramiro Acosta: encargado de turno de depósito desde marzo de 2022. Inventarios cíclicos, SAP EWM, autoelevador, equipo de 8 operarios, Excel.
- Florencia Gaitán: estudiante de Publicidad sin experiencia laboral del área. Proyectos: Instagram de una feria y piezas en Canva; "quiere aprender Google Analytics".
- Julián Ortega: community manager desde febrero de 2024. "Social Media Management", "redacción publicitaria", Canva, GA4, Looker Studio, Excel.
- Gonzalo Pereyra: jefe de cocina desde 2017. Dirige una brigada de 6 personas; su CV dice "Excelente" (no Excel).

**Resultados (todos coincidieron con lo esperado)**

| Candidato | Contable | Depósito | Marketing |
|---|---|---|---|
| Mariana Ledesma | 31/40, 77,5 %, Apto | 0 %, No Apto | 0 %, No Apto |
| Ramiro Acosta | 4/40, 10 %, No Apto | 37/40, 92,5 %, Apto | 0 %, No Apto |
| Florencia Gaitán | 0 %, No Apto | 0 %, No Apto | 14/20, 70 %, Apto |
| Julián Ortega | 4/40, 10 %, No Apto | 0 %, No Apto | 20/20, 100 %, Apto |
| Gonzalo Pereyra | 0 %, No Apto | 5/40, 12,5 %, No Apto | 0 %, No Apto |

**Comportamientos validados**

- Reconoce sinónimos, abreviaturas e inglés (`payroll`, `GA4`, `Social Media Management`). Sin el reconocimiento de `payroll`, Mariana habría obtenido 65 % y resultado No Apto.
- Reconoce habilidades implícitas en una herramienta (SAP EWM cuenta como WMS).
- No cuenta objetivos de aprendizaje (Power BI, Google Analytics).
- No cuenta herramientas parecidas pero distintas (SAP no es Tango; Looker Studio no es Power BI).
- No cuenta palabras que solo contienen el nombre de la habilidad ("Excelente" no es Excel).
- No cuenta años de experiencia en otra área para el seniority, aunque sí habilidades transferibles (el liderazgo de Gonzalo suma en Depósito).
- Un estudiante con proyectos cumple el seniority Trainee.
- El umbral es inclusivo: 70 % con mínimo 70 resulta Apto.

### Limitaciones

- La variabilidad de la IA se midió con 3 corridas por caso; no garantiza que nunca varíe.
- La prueba manual cubre 3 rubros además de desarrollo de software; otros rubros no fueron verificados.
- El peso del seniority lo define el reclutador: con un peso bajo, un candidato que no cumple el seniority puede resultar Apto por sus habilidades.
