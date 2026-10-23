import { supabaseClient } from './supabaseClient'

export interface RankedApplication {
  applicationId: string
  candidateId: string
  candidateName: string
  candidateEmail?: string | null
  candidatePhone?: string | null
  candidateDocumentId: string
  fileName: string
  earnedPoints: number
  totalPoints: number
  verdict: 'Apto' | 'No Apto'
  strengths: string[]
  gaps: string[]
  interviewQuestions: string[]
  evaluatedAt: string
}

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Supabase devolvió una evaluación con formato inválido.')
  }
  return value as Record<string, unknown>
}

const parseInterviewQuestions = (
  value: unknown,
  evaluationRunId: string,
): string[] => {
  if (!value || !Array.isArray(value)) {
    return []
  }

  return value.map((item) => {
    const questionRow = asRecord(item)
    if (
      questionRow.evaluation_run_id !== evaluationRunId ||
      typeof questionRow.question !== 'string' ||
      !questionRow.question.trim()
    ) {
      throw new Error('Supabase devolvió preguntas de entrevista con formato inválido.')
    }
    return questionRow.question.trim()
  })
}

const parseRankedApplication = (
  value: unknown,
  acceptanceThreshold?: number,
): RankedApplication => {
  const row = asRecord(value)
  const application = asRecord(row.applications)
  const candidate = asRecord(application.candidates)
  const document = asRecord(row.candidate_documents)
  if (
    typeof row.id !== 'string' ||
    typeof row.application_id !== 'string' ||
    typeof row.candidate_id !== 'string' ||
    typeof row.candidate_document_id !== 'string' ||
    typeof candidate.full_name !== 'string' ||
    typeof document.original_file_name !== 'string' ||
    typeof row.earned_points !== 'number' ||
    typeof row.total_points !== 'number' ||
    row.total_points <= 0 ||
    (row.verdict !== 'Apto' && row.verdict !== 'No Apto') ||
    !Array.isArray(row.strengths) ||
    !row.strengths.every((item) => typeof item === 'string') ||
    !Array.isArray(row.gaps) ||
    !row.gaps.every((item) => typeof item === 'string') ||
    typeof row.evaluated_at !== 'string'
  ) {
    throw new Error('Supabase devolvió una evaluación con formato inválido.')
  }

  const candidateEmail =
    typeof candidate.email === 'string' && candidate.email.trim()
      ? candidate.email.trim()
      : null
  const candidatePhone =
    typeof candidate.phone === 'string' && candidate.phone.trim()
      ? candidate.phone.trim()
      : null

  const percentage = Math.round((row.earned_points / row.total_points) * 100)
  const verdict =
    typeof acceptanceThreshold === 'number'
      ? percentage >= acceptanceThreshold
        ? 'Apto'
        : 'No Apto'
      : row.verdict

  return {
    applicationId: row.application_id,
    candidateId: row.candidate_id,
    candidateName: candidate.full_name,
    candidateEmail,
    candidatePhone,
    candidateDocumentId: row.candidate_document_id,
    fileName: document.original_file_name,
    earnedPoints: row.earned_points,
    totalPoints: row.total_points,
    verdict,
    strengths: row.strengths,
    gaps: row.gaps,
    interviewQuestions:
      verdict === 'Apto'
        ? parseInterviewQuestions(row.interview_questions, row.id)
        : [],
    evaluatedAt: row.evaluated_at,
  }
}

export async function listRankedApplications(
  recruiterId: string,
  positionId: string,
  acceptanceThreshold?: number,
): Promise<RankedApplication[]> {
  if (!supabaseClient) {
    throw new Error('Supabase no está configurado.')
  }

  let { data, error } = await supabaseClient
    .from('evaluation_runs')
    .select(
      'id, application_id, candidate_id, candidate_document_id, earned_points, total_points, verdict, strengths, gaps, evaluated_at, applications!inner(position_id, candidates!inner(full_name, email, phone)), candidate_documents!inner(original_file_name), interview_questions(evaluation_run_id, question)',
    )
    .eq('recruiter_id', recruiterId)
    .eq('status', 'completed')
    .eq('applications.position_id', positionId)
    .order('evaluated_at', { ascending: false })

  if (error && (error.code === '42703' || error.message.includes('phone'))) {
    const fallback = await supabaseClient
      .from('evaluation_runs')
      .select(
        'id, application_id, candidate_id, candidate_document_id, earned_points, total_points, verdict, strengths, gaps, evaluated_at, applications!inner(position_id, candidates!inner(full_name, email)), candidate_documents!inner(original_file_name), interview_questions(evaluation_run_id, question)',
      )
      .eq('recruiter_id', recruiterId)
      .eq('status', 'completed')
      .eq('applications.position_id', positionId)
      .order('evaluated_at', { ascending: false })
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    throw new Error(`No se pudo cargar el ranking: ${error.message}`)
  }
  if (!Array.isArray(data)) {
    throw new Error('Supabase devolvió una lista de evaluaciones inválida.')
  }

  const latestByApplication = new Map<string, RankedApplication>()
  data
    .map((item) => parseRankedApplication(item, acceptanceThreshold))
    .forEach((run) => {
      if (!latestByApplication.has(run.applicationId)) {
        latestByApplication.set(run.applicationId, run)
      }
    })

  return [...latestByApplication.values()].sort((left, right) => {
    const scoreDifference =
      right.earnedPoints / right.totalPoints -
      left.earnedPoints / left.totalPoints
    if (scoreDifference !== 0) {
      return scoreDifference
    }
    return left.candidateName.localeCompare(right.candidateName, 'es-AR')
  })
}
