# Talentiq

Talentiq es una aplicación web de apoyo para reclutadores. Permite definir los requisitos de una posición, cargar un CV y obtener un análisis de compatibilidad con un veredicto y un desglose de fortalezas y brechas. El resultado sirve como apoyo a la evaluación; la decisión de selección corresponde a las personas responsables del proceso.

## Funcionalidades de esta versión

- Definir el puesto, las habilidades requeridas y su peso individual.
- Seleccionar un nivel de seniority requerido y asignarle un peso.
- Cargar un CV en PDF de hasta 5 MB y extraer su texto para analizarlo.
- Calcular los puntos obtenidos sobre el total de puntos posibles.
- Mostrar el veredicto `Apto` o `No Apto`, usando un umbral de aprobación del 70%, junto con fortalezas y brechas.
- Cambiar entre tema claro y oscuro; la preferencia se conserva durante la sesión del navegador.

La evaluación usa Azure OpenAI cuando está configurado. Sin esa configuración, se ejecuta una evaluación local de respaldo para poder probar el flujo de la aplicación.

## Alcance y limitaciones

Esta versión es un MVP: los datos del puesto, el CV y el resultado se mantienen en memoria mientras se usa la aplicación. No incluye una base de datos persistente, un banco reutilizable de candidatos, carga masiva de CVs ni seguimiento de candidatos en entrevistas.

El CV se procesa para extraer texto; esta versión no persiste perfiles de candidatos. La carga de archivos admite PDF, con un límite de 5 MB.

## Tecnologías

- React 19 y TypeScript.
- Vite para desarrollo y compilación.
- PDF.js para extraer texto de archivos PDF.
- Azure OpenAI para el análisis inteligente cuando se configura.
- Playwright para pruebas end-to-end.
- Oxlint para análisis estático del código.

## Requisitos

- Node.js 22 o una versión compatible con Vite 8.
- npm.

## Instalación y ejecución

Desde la carpeta raíz del proyecto:

```powershell
npm ci
npm run dev
```

Vite mostrará en la terminal la dirección local para abrir la aplicación, normalmente `http://localhost:5173`.

## Configuración de Azure OpenAI

La evaluación puede ejecutarse en modo local sin configurar Azure OpenAI. Para usar el servicio de Azure, la aplicación reconoce estas variables:

```text
VITE_AZURE_OPENAI_ENDPOINT=
VITE_AZURE_OPENAI_KEY=
VITE_AZURE_OPENAI_DEPLOYMENT=
VITE_AZURE_OPENAI_API_VERSION=
```

## Pruebas y validaciones

```powershell
npm run lint
npm run build
npx playwright test
```

Las pruebas end-to-end cubren la definición de requisitos del puesto y el flujo de análisis del CV. Playwright inicia el servidor de desarrollo de Vite según `playwright.config.ts`.

## Estructura del proyecto

```text
src/
  components/   Componentes de la interfaz
  services/     Lógica de evaluación e importación de requisitos
  App.tsx       Flujo principal de la aplicación
  types.ts      Tipos compartidos
server/
  server.mjs    API auxiliar para importar requisitos de ofertas públicas
tests/          Pruebas end-to-end de Playwright
public/         Recursos estáticos
```

El servidor auxiliar se ejecuta por separado con `node server/server.mjs` y escucha en el puerto 3001 por defecto. Requiere configurar las variables de Azure OpenAI en el entorno del proceso. El flujo principal del MVP se puede probar con `npm run dev`.
