import type {
  CandidateEvaluation,
  CandidateResume,
  JobRequirements,
} from '../types'

const normalize = (value: string): string => value.trim().toLocaleLowerCase()

export function inferCandidateEvaluation(
  requirements: JobRequirements,
  resume: CandidateResume,
): CandidateEvaluation {
  const resumeText = normalize(resume.text)
  const matchedSkills = requirements.skills.filter((skill) =>
    resumeText.includes(normalize(skill)),
  )
  const missingSkills = requirements.skills.filter(
    (skill) => !matchedSkills.includes(skill),
  )
  const roleMatches =
    requirements.role.trim().length > 0 &&
    resumeText.includes(normalize(requirements.role))
  const seniorityMatches =
    requirements.seniority.trim().length > 0 &&
    resumeText.includes(normalize(requirements.seniority))
  const totalCriteria = requirements.skills.length + 2
  const fulfilledCriteria =
    matchedSkills.length + Number(roleMatches) + Number(seniorityMatches)
  const matchScore = Math.round((fulfilledCriteria / totalCriteria) * 100)
  const strengths = [
    ...matchedSkills.map((skill) => `Experiencia con ${skill}`),
    ...(roleMatches ? [`Perfil alineado al rol ${requirements.role}`] : []),
    ...(seniorityMatches
      ? [`Seniority coincidente: ${requirements.seniority}`]
      : []),
  ]
  const gaps = [
    ...missingSkills.map((skill) => `Falta experiencia con ${skill}`),
    ...(!roleMatches ? [`No se encontró el rol ${requirements.role}`] : []),
    ...(!seniorityMatches
      ? [`No se encontró el seniority ${requirements.seniority}`]
      : []),
  ]

  return {
    candidateName: resume.fileName ?? 'Candidato ingresado',
    matchScore,
    verdict: matchScore >= 60 ? 'Apto' : 'No Apto',
    strengths,
    gaps,
  }
}