# Pruebas y resultados

**Trabajo práctico:** Inteligencia Artificial Aplicada
**Entrega:** Final
**Grupo:** 2
**Institución:** Universidad Nacional de La Matanza
**Carrera y período:** Ingeniería en Informática, 2026, segundo cuatrimestre
**Demo pública:** [https://talentiq-pi.vercel.app/](https://talentiq-pi.vercel.app/)

## Resumen: validación del 12 de noviembre de 2026

| Validación | Comando | Resultado |
|---|---|---|
| Lint | `npm run lint` | Aprobado |
| Compilación TypeScript y Vite | `npm run build` | Aprobada |
| Pruebas del backend | `npm run test:server` | 29 de 29 aprobadas |
| Pruebas end-to-end | `npx playwright test` | 30 de 30 aprobadas |

Además de las pruebas automatizadas, el flujo completo se verificó en el despliegue de Vercel con Supabase y Azure OpenAI reales: inicio de sesión, puestos, carga masiva de CVs, banco de candidatos, evaluación, ranking, preguntas de entrevista y descarte de candidatos.

### Qué cubre cada tipo de prueba

- **Backend (`server/server.test.mjs`):** autenticación obligatoria en las rutas privadas, aislamiento por reclutador al guardar CVs, cálculo del puntaje a partir de las decisiones por habilidad, redondeo del porcentaje, error explícito si la IA omite una habilidad, reutilización de evaluaciones sin llamar a Azure y persistencia de evaluaciones. Usa Supabase y Azure simulados.
- **End-to-end (`tests/`):** autenticación, creación y edición de puestos, porcentaje de aceptación, estado abierto o cerrado, carga masiva con errores independientes, banco de candidatos, ranking, re-análisis al editar un puesto, descarte y restauración de candidatos, y ocultamiento de puestos cerrados en los selectores. Usa Supabase y la API simulados.
- **Con servicios reales:** la evaluación con Azure OpenAI real y la prueba manual en la aplicación se detallan en la sección siguiente; la verificación del despliegue la realizó el equipo en la demo pública.

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

- Script de pruebas que ejecuta el código real del cliente y del servidor con Azure y Supabase simulados, con una IA que responde siempre correctamente, sobre 10 casos (sinónimos, trampas de texto, puesto con 7 habilidades, seniority): antes del cambio 2 de 10 casos daban el puntaje esperado; después, 10 de 10.
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

## Antecedente: validación de la entrega MVP (25 de septiembre de 2026)

En la entrega MVP, la aplicación evaluaba un CV individual contra un puesto, sin autenticación ni persistencia. Se ejecutaron lint, build y 7 pruebas end-to-end en Chromium, todas aprobadas. Esas pruebas cubrían la definición de requisitos, la ponderación de habilidades, la carga de un PDF, el resultado del análisis y el cambio de tema, con la respuesta de Azure OpenAI simulada. Las pruebas actuales reemplazan y amplían esa cobertura.
