import type {
  CandidateEvaluation,
  CandidateResume,
  JobRequirements,
  SkillAssessment,
} from '../types'
import { extractContactInfo } from './contactInfo'

export const SENIORITY_RANGES = [
  'Trainee: hasta 1 año',
  'Junior: más de 1 y hasta 3 años',
  'Semi Senior: más de 3 y hasta 5 años',
  'Senior: más de 5 y hasta 8 años',
  'Lead: más de 8 años',
] as const

export const APPROVAL_THRESHOLD_PERCENTAGE = 70

const isSkillAssessmentList = (
  value: unknown,
): value is SkillAssessment[] =>
  Array.isArray(value) &&
  value.every(
    (item: unknown) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).skill === 'string' &&
      typeof (item as Record<string, unknown>).met === 'boolean' &&
      typeof (item as Record<string, unknown>).evidence === 'string',
  )

const isCandidateEvaluation = (
  value: unknown,
): value is CandidateEvaluation => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.candidateName === 'string' &&
    (candidate.experienceArea === undefined ||
      (typeof candidate.experienceArea === 'string' &&
        candidate.experienceArea.trim().length > 0)) &&
    (candidate.experienceAreas === undefined ||
      (Array.isArray(candidate.experienceAreas) &&
        candidate.experienceAreas.length > 0 &&
        candidate.experienceAreas.every(
          (area) => typeof area === 'string' && area.trim().length > 0,
        ))) &&
    (candidate.roleArea === undefined ||
      (typeof candidate.roleArea === 'string' &&
        candidate.roleArea.trim().length > 0)) &&
    (candidate.candidateEmail === undefined ||
      candidate.candidateEmail === null ||
      typeof candidate.candidateEmail === 'string') &&
    (candidate.candidatePhone === undefined ||
      candidate.candidatePhone === null ||
      typeof candidate.candidatePhone === 'string') &&
    typeof candidate.earnedPoints === 'number' &&
    candidate.earnedPoints >= 0 &&
    typeof candidate.totalPoints === 'number' &&
    candidate.totalPoints > 0 &&
    candidate.earnedPoints <= candidate.totalPoints &&
    (candidate.seniorityMatchesRole === undefined ||
      typeof candidate.seniorityMatchesRole === 'boolean') &&
    (candidate.skillAssessments === undefined ||
      isSkillAssessmentList(candidate.skillAssessments)) &&
    (candidate.reusedExistingEvaluation === undefined ||
      typeof candidate.reusedExistingEvaluation === 'boolean') &&
    (candidate.verdict === 'Apto' || candidate.verdict === 'No Apto') &&
    Array.isArray(candidate.strengths) &&
    candidate.strengths.every((item) => typeof item === 'string') &&
    Array.isArray(candidate.gaps) &&
    candidate.gaps.every((item) => typeof item === 'string') &&
    Array.isArray(candidate.interviewQuestions) &&
    candidate.interviewQuestions.every((item) => typeof item === 'string') &&
    (candidate.verdict === 'Apto'
      ? candidate.interviewQuestions.length === 3
      : candidate.interviewQuestions.length === 0)
  )
}

export async function inferCandidateEvaluation(
  requirements: JobRequirements,
  resume: CandidateResume,
  accessToken: string,
  positionId: string,
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
      positionId,
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

  // Score, strengths and gaps are calculated by the backend from the
  // per-skill decisions of the model. The client must not recalculate them.
  const contactInfo = extractContactInfo(resume.text)

  return {
    ...result,
    candidateEmail: result.candidateEmail || contactInfo.email,
    candidatePhone: result.candidatePhone || contactInfo.phone,
  }
}
