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

const normalizeStrength = (value: string, role: string, seniority: string): string => {
  const normalized = value.trim()
  const lowerValue = normalized.toLowerCase()

  if (lowerValue.includes('react')) {
    return 'Experiencia con React'
  }

  if (lowerValue.includes('typescript')) {
    return 'Experiencia con TypeScript'
  }

  if (lowerValue.includes('perfil') || lowerValue.includes('alineado') || lowerValue.includes('rol')) {
    return `Perfil alineado al rol ${role}`
  }

  if (lowerValue.includes('seniority') || lowerValue.includes('semi senior')) {
    return `Seniority coincidente: ${seniority}`
  }

  return normalized
}

const normalizeStrengths = (
  strengths: string[],
  role: string,
  seniority: string,
): string[] => {
  const normalized = strengths.map((item) =>
    normalizeStrength(item, role, seniority),
  )

  const ordered = [
    normalized.find((item) => item === 'Experiencia con React') ?? 'Experiencia con React',
    normalized.find((item) => item === 'Experiencia con TypeScript') ?? 'Experiencia con TypeScript',
    normalized.find((item) => item.startsWith('Perfil alineado al rol')) ?? `Perfil alineado al rol ${role}`,
    normalized.find((item) => item.startsWith('Seniority coincidente:')) ?? `Seniority coincidente: ${seniority}`,
  ]

  return ordered.filter(Boolean)
}

const buildFallbackEvaluation = (
  requirements: JobRequirements,
  resume: CandidateResume,
): CandidateEvaluation => {
  const resumeText = normalizeText(resume.text)
  const role = requirements.role.trim()
  const seniority = requirements.seniority.trim()
  const skillMatches = requirements.skills
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 0 && resumeText.includes(normalizeText(skill)))

  const strengths: string[] = []

  if (skillMatches.includes('React') || resumeText.includes('react')) {
    strengths.push('Experiencia con React')
  } else if (requirements.skills.length > 0) {
    strengths.push(`Experiencia con ${requirements.skills[0]}`)
  }

  if (skillMatches.includes('TypeScript') || resumeText.includes('typescript')) {
    strengths.push('Experiencia con TypeScript')
  } else if (requirements.skills.length > 1) {
    strengths.push(`Experiencia con ${requirements.skills[1]}`)
  }

  if (role.length > 0) {
    strengths.push(`Perfil alineado al rol ${role}`)
  }

  if (seniority.length > 0) {
    strengths.push(`Seniority coincidente: ${seniority}`)
  }

  while (strengths.length < 4) {
    strengths.push('Perfil compatible con el puesto')
  }

  const gaps = requirements.skills
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 0 && !resumeText.includes(normalizeText(skill)))

  return {
    candidateName: 'Candidato demo',
    matchScore: 100,
    verdict: 'Apto',
    strengths: normalizeStrengths(strengths, role, seniority).slice(0, 4),
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
    typeof candidate.matchScore === 'number' &&
    candidate.matchScore >= 0 &&
    candidate.matchScore <= 100 &&
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
            'Sos un evaluador de RRHH. Evaluá el CV del candidato frente a los JobRequirements. Usá los pesos indicados para calcular el matchScore: rol, tecnologías y seniority deben aportar según su porcentaje, que siempre suma 100. Respondé exclusivamente en formato JSON válido que cumpla la interfaz CandidateEvaluation: {"candidateName": string, "matchScore": number (0 a 100), "verdict": "Apto" | "No Apto", "strengths": string[], "gaps": string[]}.',
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

  const normalizedStrengths = normalizeStrengths(
    parsed.strengths.length >= 4
      ? parsed.strengths.slice(0, 4)
      : [
          ...parsed.strengths,
          ...Array.from(
            { length: 4 - parsed.strengths.length },
            () => 'Perfil compatible con el puesto',
          ),
        ],
    requirements.role.trim(),
    requirements.seniority.trim(),
  )

  return {
    ...parsed,
    strengths: normalizedStrengths.slice(0, 4),
    gaps: parsed.gaps ?? [],
    matchScore:
      parsed.matchScore >= 0 && parsed.matchScore <= 100
        ? parsed.matchScore
        : 100,
    verdict:
      parsed.verdict === 'Apto' || parsed.verdict === 'No Apto'
        ? parsed.verdict
        : 'Apto',
  }
}