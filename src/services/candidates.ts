import { supabaseClient } from './supabaseClient'

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
