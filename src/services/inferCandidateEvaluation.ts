import type {
  CandidateEvaluation,
  CandidateResume,
  JobRequirements,
} from '../types'

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
  enero: 0,
  feb: 1,
  february: 1,
  febrero: 1,
  mar: 2,
  march: 2,
  marzo: 2,
  apr: 3,
  april: 3,
  abril: 3,
  may: 4,
  mayo: 4,
  jun: 5,
  june: 5,
  junio: 5,
  jul: 6,
  july: 6,
  julio: 6,
  aug: 7,
  august: 7,
  agosto: 7,
  sep: 8,
  sept: 8,
  september: 8,
  septiembre: 8,
  oct: 9,
  october: 9,
  octubre: 9,
  nov: 10,
  november: 10,
  noviembre: 10,
  dec: 11,
  december: 11,
  diciembre: 11,
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
    /([a-záéíóú]+)\s+(20\d{2})\s*[\u2013-]\s*(present|presente|actualidad|[a-záéíóú]+\s+20\d{2})/i
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
    const isCurrent = ['present', 'presente', 'actualidad'].includes(endParts[0])
    const endMonth = isCurrent ? new Date().getMonth() : monthNumbers[endParts[0]]
    const endYear = isCurrent ? new Date().getFullYear() : Number(endParts[1])

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

  if (candidateSeniority === null && requiredRank === seniorityRank.trainee) {
    return true
  }

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
    if (seniorityRank[normalizeText(requirements.seniority)] === seniorityRank.trainee) {
      return 'Seniority coincidente'
    }

    return `Seniority no acreditado: ${requirements.seniority.trim()}`
  }

  return isSeniorityQualified(
    resumeText,
    requirements.seniority,
    requirements.role,
  )
    ? 'Seniority coincidente'
    : `Seniority detectado: ${candidateLabel} (requerido: ${requirements.seniority.trim()})`
}

const normalizeStrength = (
  value: string,
  role: string,
  senioritySummary: string,
  skillNames: string[],
): string => {
  const normalized = value.trim()
  const lowerValue = normalized.toLowerCase()

  const matchedSkill = skillNames.find((skillName) =>
    skillMatchesText(skillName, lowerValue),
  )
  if (matchedSkill) {
    const genericStrength = `Experiencia con ${matchedSkill}`
    return normalized.length > genericStrength.length + 10
      ? normalized
      : genericStrength
  }

  if (lowerValue.includes('perfil') || lowerValue.includes('alineado') || lowerValue.includes('rol')) {
    return `Perfil alineado al rol ${role}`
  }

  if (lowerValue.includes('seniority') || lowerValue.includes('semi senior')) {
    return senioritySummary
  }

  return normalized
}

const normalizeStrengths = (
  strengths: string[],
  role: string,
  senioritySummary = 'Seniority coincidente',
  skillNames: string[] = [],
  seniorityQualified = true,
): string[] => {
  const normalized = strengths.map((item) =>
    normalizeStrength(item, role, senioritySummary, skillNames),
  ).filter((item) => seniorityQualified || !item.toLowerCase().includes('seniority'))

  const ordered = [
    ...skillNames.slice(0, 2).map(
      (skillName) =>
        normalized.find(
          (item) =>
            item === `Experiencia con ${skillName}` ||
            skillMatchesText(skillName, item),
        ) ??
        `Experiencia con ${skillName}`,
    ),
    normalized.find((item) => item.startsWith('Perfil alineado al rol')) ?? `Perfil alineado al rol ${role}`,
    seniorityQualified
      ? normalized.find((item) => item.startsWith('Seniority')) ?? senioritySummary
      : undefined,
  ]

  return ordered.filter((item): item is string => Boolean(item))
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
  accessToken: string,
): Promise<CandidateEvaluation> {
  const response = await fetch('/api/evaluate-candidate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      requirements,
      resumeText: resume.text,
    }),
  })

  const result: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      typeof result === 'object' &&
      result !== null &&
      'error' in result &&
      typeof result.error === 'string'
        ? result.error
        : 'No se pudo completar el análisis.'
    throw new Error(message)
  }

  if (!isCandidateEvaluation(result)) {
    throw new Error('La respuesta de evaluación tiene un formato inválido.')
  }

  const senioritySummary = getSenioritySummary(normalizeText(resume.text), requirements)
  const seniorityMatches = isSeniorityQualified(
    normalizeText(resume.text),
    requirements.seniority,
    requirements.role,
  )
  const normalizedStrengths = normalizeStrengths(
    result.strengths.length >= 4
      ? result.strengths.slice(0, 4)
      : [
          ...result.strengths,
          ...Array.from(
            { length: 4 - result.strengths.length },
            () => 'Perfil compatible con el puesto',
          ),
        ],
    requirements.role.trim(),
    senioritySummary,
    requirements.skills.map((skill) => skill.name),
    seniorityMatches,
  )
  const verifiedStrengths = normalizedStrengths.filter(
    (strength) =>
      !requirements.skills.some(
        (skill) =>
          skillMatchesText(skill.name, strength) &&
          !skillMatchesText(skill.name, resume.text),
      ),
  )
  const normalizedGaps = result.gaps.filter(
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

  return {
    ...result,
    strengths: verifiedStrengths.slice(0, 4),
    gaps: [
      ...nonSeniorityGaps,
      ...(seniorityMatches
        ? []
        : [senioritySummary]),
      ...missingSkillGaps,
    ],
  }
}