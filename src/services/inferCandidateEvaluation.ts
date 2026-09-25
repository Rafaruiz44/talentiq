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

export const SENIORITY_RANGES = [
  'Trainee: hasta 1 año',
  'Junior: más de 1 y hasta 3 años',
  'Semi Senior: más de 3 y hasta 5 años',
  'Senior: más de 5 y hasta 8 años',
  'Lead: más de 8 años',
] as const

export const APPROVAL_THRESHOLD_PERCENTAGE = 70

const normalizeText = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')

const skillAliasGroups = [
  ['apex', 'salesforce apex'],
  ['aws', 'amazon web services'],
  ['azure', 'microsoft azure'],
  ['css', 'css3'],
  ['gcp', 'google cloud platform'],
  ['html', 'html5'],
  ['javascript', 'js', 'ecmascript'],
  ['k8s', 'kubernetes'],
  ['lwc', 'lightning web components'],
  ['mongodb', 'mongo'],
  ['node', 'node.js', 'nodejs'],
  ['postgres', 'postgresql'],
  ['react', 'react.js', 'reactjs'],
  ['rest', 'rest api', 'restful api'],
  ['salesforce', 'sf'],
  ['typescript', 'ts'],
  ['vue', 'vue.js', 'vuejs'],
]

const getSkillVariants = (value: string): string[] => {
  const normalized = normalizeText(value)
  const variants = new Set([normalized])
  const parentheticalAliases = normalized.match(/\(([^)]+)\)/g) ?? []

  parentheticalAliases.forEach((alias) => variants.add(alias.slice(1, -1).trim()))
  variants.add(normalized.replace(/\s*\([^)]*\)/g, '').trim())

  const alternatives = normalized.split(/\s+o\s+/)
  if (alternatives.length > 1) {
    alternatives.forEach((alternative, index) => {
      const trimmedAlternative = alternative.trim()
      variants.add(trimmedAlternative)

      if (index > 0) {
        const firstAlternative = alternatives[0]
        const lastDeIndex = firstAlternative.lastIndexOf(' de ')
        if (lastDeIndex >= 0) {
          const sharedPrefix = firstAlternative.slice(0, lastDeIndex + 4)
          variants.add(`${sharedPrefix}${trimmedAlternative}`)
        }
      }
    })
  }

  const aliasGroup = skillAliasGroups.find((group) =>
    group.some((alias) => variants.has(alias)),
  )
  aliasGroup?.forEach((alias) => variants.add(alias))

  return [...variants].filter(Boolean)
}

const skillMatchesText = (skillName: string, text: string): boolean =>
  getSkillVariants(skillName).some((variant) => normalizeText(text).includes(variant))

const seniorityRank: Record<string, number> = {
  trainee: 0,
  junior: 1,
  'semi senior': 2,
  senior: 3,
  lead: 4,
}

const seniorityLabels: Record<string, string> = {
  trainee: 'Trainee',
  junior: 'Junior',
  'semi senior': 'Semi Senior',
  senior: 'Senior',
  lead: 'Lead',
}

const monthNumbers: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
}

const getExperienceYearsFromDates = (
  resumeText: string,
  role: string,
): number | null => {
  const experienceSection =
    resumeText.split('professional experience')[1]?.split('education')[0] ??
    resumeText
  const rolePattern = normalizeText(role)
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+')
  if (!rolePattern) return null

  const datePattern =
    /([a-z]+)\s+(20\d{2})\s*[\u2013-]\s*(present|[a-z]+\s+20\d{2})/i
  const roleDatePattern = new RegExp(
    `${rolePattern}[\\s\\S]{0,100}?${datePattern.source}`,
    'gi',
  )
  const parsedRanges = Array.from(experienceSection.matchAll(roleDatePattern), (match) => {
    const dateMatch = match[0].match(datePattern)
    if (!dateMatch) return null

    const startMonth = monthNumbers[dateMatch[1].toLowerCase()]
    const startYear = Number(dateMatch[2])
    const endParts = dateMatch[3].toLowerCase().split(' ')
    const endMonth = endParts[0] === 'present' ? new Date().getMonth() : monthNumbers[endParts[0]]
    const endYear = endParts[0] === 'present' ? new Date().getFullYear() : Number(endParts[1])

    if (
      startMonth === undefined ||
      endMonth === undefined ||
      Number.isNaN(startYear) ||
      Number.isNaN(endYear)
    ) {
      return []
    }

    return { startMonth, startYear, endMonth, endYear }
  }).filter(
    (range): range is { startMonth: number; startYear: number; endMonth: number; endYear: number } =>
      range !== null,
  )

  if (!parsedRanges.length) return null

  const firstStart = parsedRanges.reduce((earliest, range) =>
    range.startYear < earliest.startYear ||
    (range.startYear === earliest.startYear && range.startMonth < earliest.startMonth)
      ? range
      : earliest,
  )
  const lastEnd = parsedRanges.reduce((latest, range) =>
    range.endYear > latest.endYear ||
    (range.endYear === latest.endYear && range.endMonth > latest.endMonth)
      ? range
      : latest,
  )
  const months =
    (lastEnd.endYear - firstStart.startYear) * 12 +
    lastEnd.endMonth -
    firstStart.startMonth

  return months >= 0 ? months / 12 : null
}

const seniorityFromYears = (resumeText: string, role: string): string | null => {
  const roleWords = normalizeText(role)
    .split(/\s+/)
    .filter((word) => word.length > 2)
  const roleLine = resumeText
    .split('\n')
    .find((line) => {
      const normalizedLine = normalizeText(line)
      return roleWords.every((word) => normalizedLine.includes(word))
    })
  const matches = roleLine?.match(/(\d+(?:[.,]\d+)?)\s*(?:anos?|years?)/gi)
  const years = matches
    ? Math.max(...matches.map((match) => Number.parseFloat(match.replace(',', '.'))))
    : getExperienceYearsFromDates(resumeText, role)

  if (years === null) return null

  if (years > 8) return 'lead'
  if (years > 5) return 'senior'
  if (years > 3) return 'semi senior'
  if (years > 1) return 'junior'
  return 'trainee'
}

const inferCandidateSeniority = (resumeText: string, role = ''): string | null => {
  const seniorityByYears = seniorityFromYears(resumeText, role)
  if (seniorityByYears) return seniorityByYears

  const seniorityLabels = Object.keys(seniorityRank).sort(
    (first, second) => second.length - first.length,
  )

  return seniorityLabels.find((label) => resumeText.includes(label)) ?? null
}

const isSeniorityQualified = (
  resumeText: string,
  requiredSeniority: string,
  role = '',
): boolean => {
  const requiredRank = seniorityRank[normalizeText(requiredSeniority)]
  const candidateSeniority = inferCandidateSeniority(resumeText, role)

  return (
    requiredRank !== undefined &&
    candidateSeniority !== null &&
    seniorityRank[candidateSeniority] >= requiredRank
  )
}

const getSenioritySummary = (
  resumeText: string,
  requirements: JobRequirements,
): string => {
  const candidateSeniority = inferCandidateSeniority(
    resumeText,
    requirements.role,
  )
  const candidateLabel = candidateSeniority
    ? seniorityLabels[candidateSeniority]
    : null
  if (!candidateSeniority) {
    return `Seniority no acreditado: ${requirements.seniority.trim()}`
  }

  return isSeniorityQualified(
    resumeText,
    requirements.seniority,
    requirements.role,
  )
    ? `Seniority coincidente: ${candidateLabel}`
    : `Seniority detectado: ${candidateLabel} (requerido: ${requirements.seniority.trim()})`
}

const isRoleMentioned = (resumeText: string, role: string): boolean => {
  const normalizedRole = normalizeText(role)
  if (!normalizedRole) return false

  const roleWords = normalizedRole
    .split(/\s+/)
    .filter((word) => word.length > 1)

  return roleWords.length > 0 && roleWords.every((word) => resumeText.includes(word))
}

const buildEvidenceStrengths = (
  matchedSkills: string[],
  role: string,
  senioritySummary: string,
  resumeText: string,
): string[] => {
  const evidence: string[] = matchedSkills.map((skill) => `Experiencia con ${skill}`)
  const hasSkillEvidence = matchedSkills.length > 0
  const hasRoleEvidence =
    hasSkillEvidence && role.trim().length > 0 && isRoleMentioned(resumeText, role)
  const hasSeniorityEvidence =
    senioritySummary.startsWith('Seniority coincidente:') ||
    senioritySummary.startsWith('Seniority detectado:')

  if (hasRoleEvidence) {
    evidence.push(`Perfil alineado al rol ${role}`)
  }

  if (hasSeniorityEvidence) {
    evidence.push(senioritySummary)
  }

  return evidence
}

const dedupeStrings = (values: string[]): string[] => [...new Set(values.filter(Boolean))]

const sanitizeStrengths = (
  strengths: string[],
  requirements: JobRequirements,
  resumeText: string,
): string[] => {
  const matchedSkillNames = requirements.skills
    .filter((skill) => skillMatchesText(skill.name, resumeText))
    .map((skill) => skill.name)
  const senioritySummary = getSenioritySummary(resumeText, requirements)
  const evidence = buildEvidenceStrengths(
    matchedSkillNames,
    requirements.role.trim(),
    senioritySummary,
    resumeText,
  )

  const filtered = strengths.filter((strength) => {
    const lower = strength.toLowerCase()

    if (lower.includes('perfil compatible con el puesto') || lower.includes('perfil compatible')) {
      return false
    }

    if (lower.includes('perfil alineado al rol') && matchedSkillNames.length === 0) {
      return false
    }

    if (lower.includes('seniority') && lower.includes('no acreditado')) {
      return false
    }

    return true
  })

  return dedupeStrings([...evidence, ...filtered]).slice(0, 4)
}

const buildFallbackEvaluation = (
  requirements: JobRequirements,
  resume: CandidateResume,
): CandidateEvaluation => {
  const resumeText = normalizeText(resume.text)
  const role = requirements.role.trim()
  const seniority = requirements.seniority.trim()
  const skillMatches = requirements.skills.filter(
    (skill) =>
      skill.name.trim().length > 0 &&
      skillMatchesText(skill.name, resumeText),
  )
  const seniorityMatches =
    seniority.length > 0 &&
    isSeniorityQualified(resumeText, seniority, role)
  const totalPoints =
    requirements.skills.reduce((total, skill) => total + skill.points, 0) +
    (seniority.length > 0 ? requirements.seniorityPoints : 0)
  const earnedPoints =
    skillMatches.reduce((total, skill) => total + skill.points, 0) +
    (seniorityMatches ? requirements.seniorityPoints : 0)

  const strengths = buildEvidenceStrengths(
    skillMatches.map((skill) => skill.name),
    role,
    getSenioritySummary(resumeText, requirements),
    resumeText,
  )

  const gaps = requirements.skills
    .filter(
      (skill) =>
        skill.name.trim().length > 0 &&
        !skillMatchesText(skill.name, resumeText),
    )
    .map(
      (skill) =>
        `${skill.name}: no se encontró evidencia explícita de esta habilidad en el CV.`,
    )
  if (seniority.length > 0 && !seniorityMatches) {
    gaps.push(getSenioritySummary(resumeText, requirements))
  }

  return {
    candidateName: 'Candidato demo',
    earnedPoints,
    totalPoints: Math.max(totalPoints, 1),
    verdict:
      earnedPoints / Math.max(totalPoints, 1) >= APPROVAL_THRESHOLD_PERCENTAGE / 100
        ? 'Apto'
        : 'No Apto',
    strengths: strengths.slice(0, 4),
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
            'Sos un evaluador de RRHH. Evaluá el CV del candidato frente a los JobRequirements. Cada habilidad de skills tiene un peso points independiente entre 1 y 10; el seniority tiene seniorityPoints. Para seniority, analizá únicamente las experiencias laborales cuyo título corresponda al role solicitado; no uses la experiencia total de otros roles, educación ni certificaciones. Usá estos rangos: Trainee hasta 1 año, Junior más de 1 y hasta 3 años, Semi Senior más de 3 y hasta 5 años, Senior más de 5 y hasta 8 años, Lead más de 8 años. Si el CV declara un seniority pero no informa años de experiencia relacionada con el role, usá ese nivel. Un candidato con un nivel superior al requerido está calificado igualmente y debe sumar los seniorityPoints; no lo penalices por sobrecalificación. Un candidato con un nivel inferior no cumple el seniority. Sumá los pesos de todas las habilidades y del seniority para obtener totalPoints, sin aplicar un límite máximo al total. earnedPoints debe ser la suma de los pesos de los requisitos cumplidos. Respondé Apto si la proporción de puntos obtenidos es igual o mayor al 70%, y No Apto si es menor. Para cada fortaleza, indicá la habilidad, el nivel o tipo de experiencia y la evidencia concreta encontrada en el CV; no escribas únicamente el nombre de la habilidad. Para cada brecha, indicá la habilidad faltante y explicá qué evidencia no aparece o qué requisito no queda acreditado. No inventes años, proyectos, responsabilidades ni tecnologías. Evitá duplicar una misma habilidad entre fortalezas y brechas. Respondé exclusivamente en formato JSON válido que cumpla la interfaz CandidateEvaluation: {"candidateName": string, "earnedPoints": number, "totalPoints": number, "verdict": "Apto" | "No Apto", "strengths": string[], "gaps": string[]}.',
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

  const normalizedResume = normalizeText(resume.text)
  const senioritySummary = getSenioritySummary(normalizedResume, requirements)
  const seniorityMatches = isSeniorityQualified(
    normalizedResume,
    requirements.seniority,
    requirements.role,
  )
  const verifiedStrengths = sanitizeStrengths(parsed.strengths, requirements, normalizedResume)
  const normalizedGaps = parsed.gaps.filter(
    (gap) =>
      !requirements.skills.some(
        (skill) =>
          skillMatchesText(skill.name, gap) &&
          verifiedStrengths.some((strength) =>
            skillMatchesText(skill.name, strength),
          ),
      ),
  )
  const nonSeniorityGaps = normalizedGaps.filter(
    (gap) => !gap.toLowerCase().includes('seniority'),
  )
  const missingSkillGaps = requirements.skills
    .filter((skill) => !skillMatchesText(skill.name, resume.text))
    .filter(
      (skill) =>
        !normalizedGaps.some((gap) => skillMatchesText(skill.name, gap)),
    )
    .map(
      (skill) =>
        `${skill.name}: no se encontró evidencia explícita de esta habilidad en el CV.`,
    )

  const finalStrengths = dedupeStrings(verifiedStrengths).slice(0, 4)
  const finalGaps = dedupeStrings([
    ...nonSeniorityGaps,
    ...(seniorityMatches ? [] : [senioritySummary]),
    ...missingSkillGaps,
  ]).filter(
    (gap) =>
      !finalStrengths.some((strength) =>
        requirements.skills.some(
          (skill) =>
            skillMatchesText(skill.name, gap) &&
            skillMatchesText(skill.name, strength),
        ),
      ),
  )

  return {
    ...parsed,
    strengths: finalStrengths,
    gaps: finalGaps,
    verdict:
      parsed.verdict === 'Apto' || parsed.verdict === 'No Apto'
        ? parsed.verdict
        : 'Apto',
  }
}