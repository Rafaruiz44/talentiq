import type { CandidateEvaluation } from '../types'
import type { JobRequirements } from '../types'

interface SaveEvaluationRunInput {
  accessToken: string
  candidateDocumentId: string
  candidateId: string
  evaluation: CandidateEvaluation
  positionId: string
  requirements: JobRequirements
  resumeText: string
}

export interface SavedEvaluationResult {
  applicationId: string
  evaluationRunId: string
  reusedExisting: boolean
  earnedPoints: number
  totalPoints: number
  verdict: 'Apto' | 'No Apto'
}

const getApiError = (body: unknown): string => {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'string'
  ) {
    return body.error
  }

  return 'No se pudo guardar el resultado del análisis.'
}

export async function saveEvaluationRun({
  accessToken,
  candidateDocumentId,
  candidateId,
  evaluation,
  positionId,
  requirements,
  resumeText,
}: SaveEvaluationRunInput): Promise<SavedEvaluationResult> {
  const response = await fetch('/api/evaluation-runs', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      candidateDocumentId,
      candidateId,
      evaluation,
      positionId,
      requirements,
      resumeText,
    }),
  })
  const result: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(getApiError(result))
  }

  if (
    typeof result !== 'object' ||
    result === null ||
    !('applicationId' in result) ||
    typeof result.applicationId !== 'string' ||
    !('evaluationRunId' in result) ||
    typeof result.evaluationRunId !== 'string' ||
    !('reusedExisting' in result) ||
    typeof result.reusedExisting !== 'boolean' ||
    !('earnedPoints' in result) ||
    typeof result.earnedPoints !== 'number' ||
    !('totalPoints' in result) ||
    typeof result.totalPoints !== 'number' ||
    !('verdict' in result) ||
    (result.verdict !== 'Apto' && result.verdict !== 'No Apto')
  ) {
    throw new Error('El servidor devolvió un resultado de análisis inválido.')
  }

  return {
    applicationId: result.applicationId,
    evaluationRunId: result.evaluationRunId,
    reusedExisting: result.reusedExisting,
    earnedPoints: result.earnedPoints,
    totalPoints: result.totalPoints,
    verdict: result.verdict,
  }
}
