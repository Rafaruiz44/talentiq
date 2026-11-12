# Talentiq

Talentiq es una aplicación de apoyo a reclutadores. Cada reclutador define puestos con las habilidades que necesita y su peso, sube CVs en PDF y obtiene para cada candidato un puntaje de compatibilidad, un veredicto `Apto` o `No Apto`, las fortalezas y brechas que lo justifican y preguntas de entrevista para los aptos. La evaluación usa Azure OpenAI y ayuda al análisis inicial; no reemplaza la decisión humana de selección.

Trabajo práctico de Inteligencia Artificial Aplicada (UNLaM).

## Funcionalidades

**Acceso y privacidad**

- Inicio de sesión con Google mediante Supabase Auth.
- Cada reclutador tiene un espacio privado: sus puestos, candidatos y evaluaciones no se comparten con otras cuentas. El aislamiento lo garantizan las políticas RLS de la base y la validación de sesión del backend.

**Puestos** (`/puestos`)

- Crear, consultar y editar puestos: nombre, habilidades con peso de 1 a 10, seniority requerido (`Trainee`, `Junior`, `Semi Senior`, `Senior`, `Lead`) con su peso y porcentaje mínimo de aceptación (de 50 % a 100 %, 70 % por defecto).
- Abrir o cerrar un puesto. Un puesto cerrado no admite carga ni evaluación de CVs y se oculta de los selectores, salvo que se marque "Incluir cerrados".
- Al editar un puesto se actualizan las evaluaciones existentes: si solo cambia el porcentaje mínimo se recalcula el veredicto sin llamar a la IA; si cambian habilidades, pesos o seniority, se vuelve a evaluar a los candidatos.

**Postulaciones** (`/postulaciones`)

- Carga masiva de CVs en PDF (hasta 5 MB cada uno). El texto se extrae en el navegador con PDF.js; cada archivo se procesa por separado e informa su progreso y sus errores sin frenar al resto.
- Evaluación de candidatos que ya están en el banco, sin volver a subir su CV.
- Lista de candidatos ya evaluados para el puesto, con la opción de descartarlos.

**Ranking** (`/ranking`)

- Candidatos de un puesto ordenados por compatibilidad, con el detalle de fortalezas, brechas y preguntas de entrevista.
- Descartar candidatos para ocultarlos del ranking; se pueden volver a mostrar y restaurar.

**Candidatos** (`/candidatos`)

- Banco privado con búsqueda por nombre o archivo y datos de contacto extraídos del CV.
- Reutilizar el CV guardado de un candidato para evaluarlo en otro puesto.

**Otros**

- Si se sube un CV con exactamente el mismo texto que uno ya guardado, se reutiliza en lugar de crear otro candidato.
- Si el CV, el puesto y la versión del evaluador no cambiaron, se reutiliza la evaluación guardada sin consumir tokens de Azure.
- Tema claro y oscuro.

## Cómo se evalúa un CV

1. Para cada habilidad del puesto, la IA decide si el CV la acredita y cita la evidencia. Reconoce sinónimos, abreviaturas, otros idiomas y herramientas que implican la habilidad (por ejemplo, `payroll` por liquidación de sueldos o SAP EWM por WMS). No cuenta habilidades que solo aparecen como objetivo de aprendizaje ni herramientas distintas de nombre parecido (SAP no es Tango; JavaScript no es Java).
2. La IA decide si el candidato alcanza el seniority requerido. Para `Trainee` cuentan los proyectos académicos o personales; para los demás niveles, solo el tiempo de trabajo formal en experiencias compatibles con el área del puesto, decididas por el cargo y las tareas, no por las herramientas compartidas. Rangos: Trainee hasta 1 año, Junior hasta 3, Semi Senior hasta 5, Senior hasta 8 y Lead más de 8; un nivel superior al requerido cumple.
3. El backend calcula el puntaje sumando los pesos de las habilidades acreditadas y el peso del seniority si se cumple. El porcentaje se redondea al entero más cercano y el candidato es `Apto` si alcanza el mínimo del puesto.
4. Para los candidatos aptos se generan tres preguntas de entrevista basadas en el cruce entre el CV y el puesto.

El puntaje lo calcula siempre el servidor a partir de las decisiones de la IA; el navegador no puede modificarlo. La validación de este mecanismo con Azure real y con una prueba manual en varios rubros está en [documentacion/pruebas-y-resultados.md](documentacion/pruebas-y-resultados.md).

## Fuera del alcance de la entrega

Estas funcionalidades quedaron fuera de la entrega final:

- Etapa `En entrevista` por postulación (la etapa `Descartado` sí está disponible).
- Detectar a la misma persona cuando sube un CV actualizado: solo se reconoce un CV con texto idéntico.
- Eliminar candidatos y documentos desde la aplicación.
- Historial completo de evaluaciones de una postulación: se conserva solo la evaluación vigente.
- Importar requisitos desde ofertas de LinkedIn o Computrabajo desde el formulario de puestos: existe en el backend, pero no está conectada a la interfaz.
- OCR: los PDF escaneados sin texto seleccionable no se pueden analizar.

El estado detallado de cada funcionalidad, incluido qué se verificó contra servicios reales y qué solo con pruebas simuladas, está en [PROYECTO-ACTUAL.md](PROYECTO-ACTUAL.md).

## Tecnologías

- React 19, TypeScript y Vite.
- PDF.js (`pdfjs-dist`) para extraer el texto de los PDF en el navegador.
- Node.js nativo para la API, desplegada como Vercel Functions.
- Supabase: autenticación con Google, base de datos Postgres con RLS y almacenamiento privado de CVs.
- Azure OpenAI para la evaluación, las preguntas de entrevista y la importación de ofertas, llamado solo desde el backend.
- Playwright para pruebas end-to-end, `node --test` para pruebas del backend y Oxlint para análisis estático.

## Instalación y ejecución local

Requisitos: Node.js 22 o una versión compatible con Vite 8, y npm.

```powershell
npm ci
npm run dev
```

Vite muestra la URL local, normalmente `http://localhost:5173`. La API se ejecuta en una segunda terminal:

```powershell
npm run dev:api
```

Escucha en el puerto 3001 y Vite le reenvía las rutas `/api`. Sin la API levantada se puede iniciar sesión, pero no analizar CVs.

### Variables de entorno

Crear un archivo `.env` en la raíz (está en `.gitignore`) con:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable-or-anon-key>
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<publishable-or-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com
AZURE_OPENAI_KEY=<server-only-azure-openai-key>
AZURE_OPENAI_DEPLOYMENT=<deployment-name>
AZURE_OPENAI_API_VERSION=<api-version>
APP_ORIGIN=http://localhost:5173
```

- Solo las variables con prefijo `VITE_` llegan al navegador (`envPrefix` en `vite.config.ts`). Son la URL y la clave pública de Supabase, necesarias para el login.
- El resto son exclusivas del backend y nunca deben llevar el prefijo `VITE_`. `SUPABASE_SERVICE_ROLE_KEY` es una credencial administrativa; si una clave secreta llegó a estar en un bundle público, hay que revocarla y generar una nueva.

### Supabase

La configuración del proyecto y de Google OAuth está en [documentacion/configuracion-supabase-google-auth.md](documentacion/configuracion-supabase-google-auth.md). El esquema, las políticas RLS, el bucket privado y las funciones de la base están en [supabase/migrations/](supabase/migrations/) y se aplican en orden de nombre. Agregar `http://localhost:5173` y la URL de producción a las URL de redirección permitidas.

### Despliegue en Vercel

`api/[...route].mjs`, `api/candidates.mjs` y `api/candidates/lookup.mjs` adaptan la API a Vercel Functions. El build es `npm run build` y la salida es `dist`. Las variables de entorno son las mismas del bloque anterior, con `APP_ORIGIN` apuntando a la URL de producción, y se cargan en Vercel > Settings > Environment Variables. Después de modificarlas hay que crear un deployment nuevo.

## Pruebas

```powershell
npm run lint
npm run build
npm run test:server
npx playwright test
```

- `test:server` prueba la API con Supabase y Azure simulados: autenticación, aislamiento por reclutador, cálculo del puntaje, reutilización de evaluaciones y persistencia.
- Playwright prueba los flujos de la interfaz con Supabase y la API simulados, y levanta la API y Vite automáticamente. La primera vez hay que instalar el navegador con `npx playwright install chromium`.
- Ninguna de estas pruebas llama a Azure real. Las validaciones con Azure y las pruebas manuales están documentadas en [documentacion/pruebas-y-resultados.md](documentacion/pruebas-y-resultados.md).

## Estructura

```text
src/
  components/      Pantallas y componentes de la interfaz
  services/        Acceso a Supabase y a la API, extracción de texto de PDF
  App.tsx          Navegación y flujo principal
  types.ts         Contratos compartidos
server/
  server.mjs       API autenticada: evaluación, candidatos e importación de ofertas
  server.test.mjs  Pruebas del backend
api/               Adaptadores de la API para Vercel Functions
tests/             Pruebas end-to-end con Playwright
supabase/
  migrations/      Esquema, políticas RLS y funciones de la base
documentacion/     Arquitectura, alcance, historias de usuario, pruebas y uso de IA
```

## Documentación

- [PROYECTO-ACTUAL.md](PROYECTO-ACTUAL.md): estado y verificación de cada funcionalidad.
- [documentacion/arquitectura-y-alcance.md](documentacion/arquitectura-y-alcance.md): arquitectura y alcance.
- [documentacion/alcance-entrega-final-y-historias.md](documentacion/alcance-entrega-final-y-historias.md): alcance de la entrega final e historias de usuario.
- [documentacion/pruebas-y-resultados.md](documentacion/pruebas-y-resultados.md): pruebas y resultados.
- [documentacion/uso-de-IA-en-el-SDLC.md](documentacion/uso-de-IA-en-el-SDLC.md): uso de IA en el desarrollo.
