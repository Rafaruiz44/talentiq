import type {
  CandidateEvaluation,
  CandidateResume,
  JobRequirements,
} from '../types'

interface AzureOpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

const isCandidateEvaluation = (
  value: unknown,
): value is CandidateEvaluation => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.candidateName === 'string' &&
    typeof candidate.earnedPoints === 'number' &&
    candidate.earnedPoints >= 0 &&
    typeof candidate.totalPoints === 'number' &&
    candidate.totalPoints > 0 &&
    candidate.earnedPoints <= candidate.totalPoints &&
    (candidate.verdict === 'Apto' || candidate.verdict === 'No Apto') &&
    Array.isArray(candidate.strengths) &&
    candidate.strengths.every((item) => typeof item === 'string') &&
    Array.isArray(candidate.gaps) &&
    candidate.gaps.every((item) => typeof item === 'string')
  )
}

export async function inferCandidateEvaluation(
  requirements: JobRequirements,
  resume: CandidateResume,
): Promise<CandidateEvaluation> {
  const endpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT as string | undefined
  const key = import.meta.env.VITE_AZURE_OPENAI_KEY as string | undefined
  const deployment = import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT as
    | string
    | undefined
  const apiVersion = import.meta.env.VITE_AZURE_OPENAI_API_VERSION as
    | string
    | undefined

  if (!endpoint || !key || !deployment || !apiVersion) {
    throw new Error('Faltan variables de entorno de Azure OpenAI.')
  }

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': key,
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content:
            'Sos un evaluador de RRHH. Evaluá el CV del candidato frente a los JobRequirements. Cada habilidad tiene puntos propios y el seniority tiene seniorityPoints; calculá earnedPoints y totalPoints según los requisitos cumplidos. Respondé Apto si la proporción de puntos obtenidos es igual o mayor al 70%, y No Apto si es menor. Respondé exclusivamente en formato JSON válido que cumpla la interfaz CandidateEvaluation: {"candidateName": string, "earnedPoints": number, "totalPoints": number, "verdict": "Apto" | "No Apto", "strengths": string[], "gaps": string[]}.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            jobRequirements: requirements,
            candidateResume: resume.text,
          }),
        },
      ],
    }),
  })

  if (!response.ok) {
    const errorDetails: unknown = await response.json()
    console.error('Detalle error Azure:', errorDetails)
    throw new Error(
      `Azure OpenAI error ${response.status}: ${JSON.stringify(errorDetails)}`,
    )
  }

  const data = (await response.json()) as AzureOpenAIResponse
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('Azure OpenAI no devolvió contenido.')
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('Azure OpenAI devolvió un JSON inválido.')
  }

  if (!isCandidateEvaluation(parsed)) {
    throw new Error('La respuesta no cumple el contrato CandidateEvaluation.')
  }

  return parsed
}