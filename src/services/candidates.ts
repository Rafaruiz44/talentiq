import { supabaseClient } from './supabaseClient'

export interface SavedCandidateDocument {
  id: string
  fileName: string
  status: 'pending' | 'processing' | 'processed' | 'failed'
  createdAt: string
}

export interface SavedCandidate {
  id: string
  name: string
  createdAt: string
  documents: SavedCandidateDocument[]
}

export interface SavedCandidateResume {
  candidateId: string
  candidateDocumentId: string
  fileName: string
  text: string
}

interface SaveCandidateDocumentInput {
  accessToken: string
  candidateName: string
  extractedText: string
  file: File
  recruiterId: string
}

interface SaveCandidateDocumentResult {
  candidateId: string
  candidateDocumentId: string
  reusedExisting: boolean
  cleanupWarning?: string
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

  return 'No se pudo guardar el CV en el banco de candidatos.'
}

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Supabase devolvió un candidato con formato inválido.')
  }

  return value as Record<string, unknown>
}

const isDocumentStatus = (
  value: unknown,
): value is SavedCandidateDocument['status'] =>
  value === 'pending' ||
  value === 'processing' ||
  value === 'processed' ||
  value === 'failed'

const parseSavedCandidate = (value: unknown): SavedCandidate => {
  const row = asRecord(value)
  if (
    typeof row.id !== 'string' ||
    typeof row.full_name !== 'string' ||
    typeof row.created_at !== 'string' ||
    !Array.isArray(row.candidate_documents)
  ) {
    throw new Error('Supabase devolvió un candidato con formato inválido.')
  }

  const documents = row.candidate_documents.map((documentValue) => {
    const document = asRecord(documentValue)
    if (
      typeof document.id !== 'string' ||
      typeof document.original_file_name !== 'string' ||
      !isDocumentStatus(document.processing_status) ||
      typeof document.created_at !== 'string'
    ) {
      throw new Error('Supabase devolvió un CV con formato inválido.')
    }
    return {
      id: document.id,
      fileName: document.original_file_name,
      status: document.processing_status,
      createdAt: document.created_at,
    }
  })

  return {
    id: row.id,
    name: row.full_name,
    createdAt: row.created_at,
    documents,
  }
}

export async function listSavedCandidates(
  recruiterId: string,
): Promise<SavedCandidate[]> {
  if (!supabaseClient) {
    throw new Error('Supabase no está configurado.')
  }

  const { data, error } = await supabaseClient
    .from('candidates')
    .select(
      'id, full_name, created_at, candidate_documents(id, original_file_name, processing_status, created_at)',
    )
    .eq('recruiter_id', recruiterId)
    .order('full_name', { ascending: true })

  if (error) {
    throw new Error(`No se pudieron cargar los candidatos: ${error.message}`)
  }
  if (!Array.isArray(data)) {
    throw new Error('Supabase devolvió una lista de candidatos inválida.')
  }

  return data.map(parseSavedCandidate)
}

export async function getSavedCandidateResume({
  recruiterId,
  candidateId,
  candidateDocumentId,
}: {
  recruiterId: string
  candidateId: string
  candidateDocumentId: string
}): Promise<SavedCandidateResume> {
  if (!supabaseClient) {
    throw new Error('Supabase no está configurado.')
  }

  const { data, error } = await supabaseClient
    .from('candidate_documents')
    .select('candidate_id, id, original_file_name, extracted_text, processing_status')
    .eq('recruiter_id', recruiterId)
    .eq('candidate_id', candidateId)
    .eq('id', candidateDocumentId)
    .eq('processing_status', 'processed')
    .maybeSingle()

  if (error) {
    throw new Error(`No se pudo cargar el CV seleccionado: ${error.message}`)
  }
  if (
    !data ||
    typeof data.candidate_id !== 'string' ||
    typeof data.id !== 'string' ||
    typeof data.original_file_name !== 'string' ||
    typeof data.extracted_text !== 'string' ||
    !data.extracted_text.trim()
  ) {
    throw new Error('El CV seleccionado no está disponible para analizar.')
  }

  return {
    candidateId: data.candidate_id,
    candidateDocumentId: data.id,
    fileName: data.original_file_name,
    text: data.extracted_text,
  }
}

export async function saveCandidateDocument({
  accessToken,
  candidateName,
  extractedText,
  file,
  recruiterId,
}: SaveCandidateDocumentInput): Promise<SaveCandidateDocumentResult> {
  if (!supabaseClient) {
    throw new Error('Supabase no está configurado.')
  }

  if (
    file.type !== 'application/pdf' ||
    file.size === 0 ||
    file.size > 5 * 1024 * 1024
  ) {
    throw new Error('El CV debe ser un PDF de hasta 5 MB.')
  }

  const lookupResponse = await fetch('/api/candidates/lookup', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ extractedText }),
  })
  const lookupResult: unknown = await lookupResponse.json().catch(() => null)

  if (!lookupResponse.ok) {
    throw new Error(getApiError(lookupResult))
  }

  if (
    typeof lookupResult !== 'object' ||
    lookupResult === null ||
    !('found' in lookupResult) ||
    typeof lookupResult.found !== 'boolean'
  ) {
    throw new Error('El servidor devolvió una respuesta inválida al buscar el CV.')
  }

  if (lookupResult.found) {
    if (
      !('candidateId' in lookupResult) ||
      typeof lookupResult.candidateId !== 'string' ||
      !lookupResult.candidateId ||
      !('candidateDocumentId' in lookupResult) ||
      typeof lookupResult.candidateDocumentId !== 'string' ||
      !lookupResult.candidateDocumentId
    ) {
      throw new Error('El servidor devolvió identificadores de CV inválidos.')
    }

    return {
      candidateId: lookupResult.candidateId,
      candidateDocumentId: lookupResult.candidateDocumentId,
      reusedExisting: true,
    }
  }

  const storagePath = `${recruiterId}/${crypto.randomUUID()}/resume.pdf`
  const { error: uploadError } = await supabaseClient.storage
    .from('candidate-cvs')
    .upload(storagePath, file, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`No se pudo guardar el archivo CV: ${uploadError.message}`)
  }

  try {
    const response = await fetch('/api/candidates', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        candidateName,
        extractedText,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        storagePath,
      }),
    })
    const result: unknown = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(getApiError(result))
    }

    if (
      typeof result !== 'object' ||
      result === null ||
      !('candidateId' in result) ||
      typeof result.candidateId !== 'string' ||
      !('candidateDocumentId' in result) ||
      typeof result.candidateDocumentId !== 'string' ||
      !('reusedExisting' in result) ||
      typeof result.reusedExisting !== 'boolean'
    ) {
      throw new Error('El servidor devolvió identificadores de CV inválidos.')
    }

    let cleanupWarning: string | undefined
    if (result.reusedExisting) {
      const { error: cleanupError } = await supabaseClient.storage
        .from('candidate-cvs')
        .remove([storagePath])

      if (cleanupError) {
        cleanupWarning = ` No se pudo eliminar el archivo duplicado del bucket: ${cleanupError.message}`
      }
    }

    return {
      candidateId: result.candidateId,
      candidateDocumentId: result.candidateDocumentId,
      reusedExisting: result.reusedExisting,
      cleanupWarning,
    }
  } catch (saveError) {
    const { error: cleanupError } = await supabaseClient.storage
      .from('candidate-cvs')
      .remove([storagePath])

    if (cleanupError) {
      const saveMessage =
        saveError instanceof Error
          ? saveError.message
          : 'No se pudo guardar el CV.'
      throw new Error(
        `${saveMessage} Además, no se pudo eliminar el archivo temporal: ${cleanupError.message}`,
      )
    }

    throw saveError
  }
}
