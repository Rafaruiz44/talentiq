# Talentiq

Talentiq es una aplicación de apoyo a reclutadores para comparar requisitos de una posición con la información de un CV y revisar un puntaje, un veredicto y un desglose de fortalezas y brechas. La evaluación ayuda al análisis inicial; no reemplaza la decisión humana de selección.

## Estado del proyecto

El repositorio contiene el MVP ejecutable localmente. El alcance acordado para la entrega final amplía ese MVP con cuentas de reclutadores mediante Google, espacios privados por empresa, posiciones y candidatos persistentes, carga masiva, evaluaciones candidato–posición, seguimiento de etapas, preguntas de entrevista y despliegue accesible.

Esas capacidades ampliadas están planificadas y no deben considerarse implementadas solo por estar documentadas. La arquitectura objetivo, el estado actual y las decisiones pendientes se describen en [documentacion/arquitectura-y-alcance.md](documentacion/arquitectura-y-alcance.md); las historias y sus criterios de aceptación están en [documentacion/alcance-entrega-final-y-historias.md](documentacion/alcance-entrega-final-y-historias.md).

## Funcionalidades actuales del MVP

- Definir el nombre del puesto, habilidades con peso individual y seniority requerido con su peso.
- Cargar un CV PDF individual de hasta 5 MB y extraer su texto con PDF.js en el navegador.
- Ejecutar un análisis de compatibilidad y mostrar puntaje, veredicto `Apto` o `No Apto`, fortalezas y brechas.
- Cambiar entre tema claro y oscuro; la preferencia se conserva en `sessionStorage`.

El umbral actual de aprobación está fijado en 70 %. La posición, el CV y el resultado se mantienen en memoria; no existe persistencia de esos datos. Si Azure OpenAI no está configurado, el MVP usa una evaluación local de respaldo.

## Alcance acordado para la entrega final

- Registro e inicio de sesión de reclutadores con Google.
- Creación de una empresa e invitación de compañeros al espacio privado compartido de la empresa.
- Aislamiento de los bancos de CVs entre empresas.
- Posiciones persistentes con estado `Nueva`, `Abierta`, `Cubierta` o `Cancelada`.
- Banco privado de candidatos: persistencia de datos y texto extraído, y almacenamiento del archivo original en un bucket privado.
- Carga masiva de CVs con progreso y errores por archivo.
- Evaluaciones persistentes de un candidato frente a una o varias posiciones abiertas, con resultado separado por cada cruce.
- Etapas independientes por relación candidato–posición: `Evaluado`, `En entrevista` o `Descartado`.
- Preguntas de entrevista basadas en los requisitos, fortalezas y brechas del cruce elegido.
- Evaluación y generación de preguntas de Azure OpenAI desde un backend, sin claves secretas en el frontend.
- Despliegue accesible con verificación de un flujo integrado.

La elección de proveedor de autenticación, base de datos, almacenamiento privado y hosting sigue pendiente. También resta definir permisos de miembros, duplicados, límites de archivo, retención y eliminación de datos personales. No hay una demo pública desplegada a la fecha de esta documentación.

## Tecnologías presentes

- React 19 y TypeScript.
- Vite.
- PDF.js (`pdfjs-dist`) para extraer texto de PDFs en el navegador.
- Azure OpenAI en el flujo actual de evaluación, si está configurado.
- Node.js nativo para una API auxiliar de importación de requisitos desde ofertas públicas.
- Playwright para pruebas end-to-end.
- Oxlint para análisis estático.

La base de datos, el proveedor de autenticación, el bucket privado y el hosting de la arquitectura final todavía no están incorporados al proyecto.

## Requisitos

- Node.js 22 o una versión compatible con Vite 8.
- npm.

## Instalación y ejecución local

Desde la carpeta raíz del proyecto:

```powershell
npm ci
npm run dev
```

Vite mostrará la URL local, normalmente `http://localhost:5173`.

El servidor auxiliar de importación se ejecuta por separado:

```powershell
node server/server.mjs
```

Escucha en el puerto 3001 por defecto y requiere configurar las variables de Azure OpenAI en el entorno del proceso para usar la importación asistida. Este endpoint auxiliar no forma parte del flujo principal de evaluación del MVP.

## Configuración de IA

El código actual reconoce las variables `VITE_AZURE_OPENAI_ENDPOINT`, `VITE_AZURE_OPENAI_KEY`, `VITE_AZURE_OPENAI_DEPLOYMENT` y `VITE_AZURE_OPENAI_API_VERSION` para su evaluación desde el navegador. Por el prefijo `VITE_`, los valores pueden quedar incluidos en el bundle público: **no configurar una clave real de Azure de esta manera en un despliegue accesible**.

Para la entrega final, las llamadas de evaluación y generación de preguntas deben pasar por el backend y las credenciales deben configurarse únicamente en el entorno seguro del servidor. La integración real con Azure no queda verificada por las pruebas actuales.

## Pruebas y validaciones

```powershell
npm run lint
npm run build
npx playwright test
```

Las pruebas E2E existentes cubren definición de requisitos, carga y análisis de un CV, y cambio de tema. Las pruebas del alcance ampliado —autenticación, aislamiento entre empresas, persistencia, lotes, cruces, etapas, generación de preguntas y despliegue— todavía deben incorporarse.

## Estructura principal

```text
src/
  components/   Componentes de la interfaz
  services/     Evaluación e importación de requisitos del MVP
  App.tsx       Flujo principal actual
  types.ts      Contratos actuales
server/
  server.mjs    API auxiliar para importar requisitos de ofertas
tests/          Pruebas end-to-end del MVP
documentacion/
  arquitectura-y-alcance.md
  alcance-entrega-final-y-historias.md
```
