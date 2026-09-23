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

const normalizeText = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const buildFallbackEvaluation = (
  requirements: JobRequirements,
  resume: CandidateResume,
): CandidateEvaluation => {
  const resumeText = normalizeText(resume.text)
  const seniority = requirements.seniority.trim()
  const matchedSkills = requirements.skills.filter((skill) =>
    resumeText.includes(normalizeText(skill.name)),
  )
  const gaps = requirements.skills
    .filter((skill) => !matchedSkills.includes(skill))
    .map((skill) => `Falta experiencia con ${skill.name}`)
  const seniorityMatches = resumeText.includes(normalizeText(seniority))
  const totalPoints =
    requirements.skills.reduce((total, skill) => total + skill.points, 0) +
    requirements.seniorityPoints
  const earnedPoints =
    matchedSkills.reduce((total, skill) => total + skill.points, 0) +
    (seniorityMatches ? requirements.seniorityPoints : 0)
  const strengths = matchedSkills.map((skill) => `Experiencia con ${skill.name}`)

  if (seniorityMatches) strengths.push(`Seniority coincidente: ${seniority}`)

  return {
    candidateName: 'Candidato demo',
    earnedPoints,
    totalPoints,
    verdict: earnedPoints / totalPoints >= 0.7 ? 'Apto' : 'No Apto',
    strengths,
    gaps,
  }
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
    return buildFallbackEvaluation(requirements, resume)
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
            'Sos un evaluador de RRHH. Evaluá el CV del candidato frente a los JobRequirements. Cada habilidad de skills tiene un peso points independiente entre 1 y 10; el seniority tiene seniorityPoints. Sumá los pesos de todas las habilidades y del seniority para obtener totalPoints, sin aplicar un límite máximo al total. earnedPoints debe ser la suma de los pesos de los requisitos cumplidos. Respondé Apto si la proporción de puntos obtenidos es igual o mayor al 70%, y No Apto si es menor. Respondé exclusivamente en formato JSON válido que cumpla la interfaz CandidateEvaluation: {"candidateName": string, "earnedPoints": number, "totalPoints": number, "verdict": "Apto" | "No Apto", "strengths": string[], "gaps": string[]}.',
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
    return buildFallbackEvaluation(requirements, resume)
  }

  return {
    ...parsed,
    strengths: parsed.strengths,
    gaps: parsed.gaps,
  }
}