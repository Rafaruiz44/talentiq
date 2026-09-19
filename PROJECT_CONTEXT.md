# Talentiq — Contexto del proyecto

## 1. Objetivo del MVP
Talentiq es un analizador inteligente de CV para reclutadores, orientado a una demo de clase. La app permite:
- definir los requisitos del puesto,
- cargar un CV,
- ejecutar análisis de compatibilidad,
- visualizar un resultado con match, veredicto y desglose justificado.

## 2. Alcance y límites del proyecto
- Stack: Vite + React 18 + TypeScript en modo strict.
- Estado local en memoria con useState.
- CSS simple o utilitario.
- IA simulada o conectada mediante endpoint serverless/API básica.
- Pruebas E2E con Playwright en TypeScript.
- Scope cerrado: solo dos features:
  1. Carga y definición de vacante.
  2. Análisis y visualización de compatibilidad.
- Deben implementarse exactamente 4 user stories relacionadas con esas features.
- No se debe agregar autenticación, bases de datos persistentes ni procesamiento masivo por lotes.

## 3. Reglas de implementación
- Nunca usar any.
- Un componente por archivo, siempre con export nombrado.
- Usar elementos HTML nativos (button, input, label, textarea); nunca un div con onClick.
- Agregar data-testid en kebab-case a todo elemento que una prueba necesite.
- No instalar dependencias sin preguntar primero.
- Mantener cambios dentro del alcance del MVP.

## 4. Estructura principal
- src/App.tsx: flujo principal de la aplicación.
- src/types.ts: contratos de datos principales (JobRequirements, CandidateResume, CandidateEvaluation).
- src/components/JobRequirementsForm.tsx: formulario de requisitos del puesto.
- src/components/CvUpload.tsx: carga de texto/archivo PDF o TXT del CV.
- src/components/AnalysisControls.tsx: botón para disparar análisis.
- src/components/EvaluationResults.tsx: visualización del resultado con score, veredicto y lista de fortalezas/brechas.
- src/services/inferCandidateEvaluation.ts: lógica de análisis con Azure OpenAI.
- tests/definicion-puesto.spec.ts: pruebas del alta/validación de requisitos del puesto.
- tests/analisis-cv.spec.ts: pruebas del flujo de carga CV + análisis.

## 5. Flujo funcional
1. El reclutador completa rol, skills y seniority.
2. Carga un CV desde texto o archivo PDF/TXT.
3. Presiona el botón de análisis.
4. La app valida que el formulario tenga datos completos.
5. Se invoca inferCandidateEvaluation.
6. El servicio llama a Azure OpenAI con el prompt del puesto y el texto del CV.
7. La respuesta debe cumplir el contrato CandidateEvaluation:
   - candidateName: string
   - matchScore: number (0-100)
   - verdict: 'Apto' | 'No Apto'
   - strengths: string[]
   - gaps: string[]
8. Se renderiza el resultado en pantalla con porcentaje, veredicto, fortalezas y brechas.

## 6. Contratos de datos clave
### JobRequirements
- role: string
- skills: string[]
- seniority: string

### CandidateResume
- text: string
- fileName: string | null

### CandidateEvaluation
- candidateName: string
- matchScore: number
- verdict: 'Apto' | 'No Apto'
- strengths: string[]
- gaps: string[]

## 7. Variables de entorno esperadas
El servicio Azure OpenAI usa estas variables:
- VITE_AZURE_OPENAI_ENDPOINT
- VITE_AZURE_OPENAI_KEY
- VITE_AZURE_OPENAI_DEPLOYMENT
- VITE_AZURE_OPENAI_API_VERSION

Si faltan, la app debe mostrar error de configuración clara.

## 8. Cómo orientar una tarea sin leer todo el código
Cuando un agente necesite entender el proyecto, debe partir por este orden:
1. Leer este archivo.
2. Revisar App.tsx para ver el flujo principal.
3. Ir a los componentes específicos involucrados.
4. Revisar solo el servicio o la prueba que corresponda.
5. Evitar abrir archivos ajenos a la funcionalidad pedida.

## 9. Backlog base esperado
El MVP debe alinearse con estas 2 Features y 4 User Stories:
- Feature 1: Carga y definición del puesto
  - Ingresar requerimientos del puesto.
  - Cargar un CV.
- Feature 2: Análisis y resultados
  - Ejecutar análisis inteligente con match y veredicto Apto/No Apto.
  - Ver el desglose justificado con fortalezas y brechas.

## 10. Punto de entrada recomendado para agentes
- Necesitar contexto general: leer este documento.
- Necesitar revisar flujo principal: App.tsx.
- Necesitar validar comportamiento de UI: tests/.
- Necesitar revisar lógica del análisis: src/services/inferCandidateEvaluation.ts.

Este archivo es la referencia corta del proyecto y debe usarse como mapa de navegación antes de explorar el código.
