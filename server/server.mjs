import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const maxBodyLength = 3_000_000
const maxSourceLength = 500_000
const maxResumeLength = 600_000
const evaluatorVersion = 'candidate-evaluation-v1'
const getContentFingerprint = (text) =>
  createHash('md5').update(text, 'utf8').digest('hex')
const getEvaluationFingerprint = (requirements, resumeText) =>
  createHash('sha256')
    .update(
      JSON.stringify({
        evaluatorVersion,
        requirements: {
          role: requirements.role,
          seniority: requirements.seniority,
          seniorityPoints: requirements.seniorityPoints,
          skills: requirements.skills.map(({ name, points }) => ({
            name,
            points,
          })),
        },
        resumeText,
      }),
      'utf8',
    )
    .digest('hex')
const seniorities = new Set([
  'Trainee',
  'Junior',
  'Semi Senior',
  'Senior',
  'Lead',
])

class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const sendJson = (response, statusCode, body, origin, allowedOrigin) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }

  if (origin && origin === allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = origin
  }

  response.writeHead(statusCode, headers)
  response.end(statusCode === 204 ? undefined : JSON.stringify(body))
}

const readRequestBody = async (request) => {
  let body = ''
  let bodyLength = 0

  for await (const chunk of request) {
    bodyLength += Buffer.byteLength(chunk)
    if (bodyLength > maxBodyLength) {
      throw new ApiError(413, 'El cuerpo de la solicitud es demasiado grande.')
    }
    body += chunk
  }

  try {
    return JSON.parse(body)
  } catch {
    throw new ApiError(400, 'El cuerpo de la solicitud no es JSON válido.')
  }
}

const getSupabaseConfiguration = (env) => ({
  url: (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? '').replace(/\/$/, ''),
  anonKey: env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY,
})

const requireAuthenticatedUser = async (request, env, fetchImpl) => {
  const authorization = request.headers.authorization
  const accessToken =
    typeof authorization === 'string'
      ? authorization.match(/^Bearer\s+(.+)$/i)?.[1]
      : undefined

  if (!accessToken) {
    throw new ApiError(401, 'Iniciá sesión para realizar esta operación.')
  }

  const { url, anonKey } = getSupabaseConfiguration(env)
  if (!url || !anonKey) {
    throw new ApiError(503, 'La autenticación del servidor no está configurada.')
  }

  let response
  try {
    response = await fetchImpl(`${url}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new ApiError(502, 'No se pudo verificar la sesión con Supabase.')
  }

  if (!response.ok) {
    throw new ApiError(401, 'La sesión no es válida o venció. Iniciá sesión nuevamente.')
  }

  let user
  try {
    user = await response.json()
  } catch {
    throw new ApiError(502, 'Supabase devolvió una respuesta de sesión inválida.')
  }

  if (!user || typeof user.id !== 'string' || !user.id) {
    throw new ApiError(401, 'Supabase no confirmó una identidad válida.')
  }

  return user
}

const getAzureConfiguration = (env) => {
  const endpoint = env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, '')
  const key = env.AZURE_OPENAI_KEY
  const deployment = env.AZURE_OPENAI_DEPLOYMENT
  const apiVersion = env.AZURE_OPENAI_API_VERSION

  if (!endpoint || !key || !deployment || !apiVersion) {
    throw new ApiError(503, 'Azure OpenAI no está configurado en el servidor.')
  }

  let parsedEndpoint
  try {
    parsedEndpoint = new URL(endpoint)
  } catch {
    throw new ApiError(503, 'La URL de Azure OpenAI no es válida.')
  }

  if (parsedEndpoint.protocol !== 'https:') {
    throw new ApiError(503, 'Azure OpenAI debe usar una conexión HTTPS.')
  }

  return { endpoint, key, deployment, apiVersion }
}

const createCandidateDocument = async (
  userId,
  candidateInput,
  env,
  fetchImpl,
) => {
  const {
    candidateName,
    extractedText,
    fileName,
    mimeType,
    sizeBytes,
    storagePath,
  } = candidateInput ?? {}
  const storagePathParts =
    typeof storagePath === 'string' ? storagePath.split('/') : []
  const validStoragePath =
    storagePathParts.length === 3 &&
    storagePathParts[0] === userId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      storagePathParts[1],
    ) &&
    storagePathParts[2] === 'resume.pdf'

  if (
    typeof candidateName !== 'string' ||
    !candidateName.trim() ||
    candidateName.length > 200 ||
    typeof extractedText !== 'string' ||
    !extractedText.trim() ||
    extractedText.length > maxResumeLength ||
    typeof fileName !== 'string' ||
    !fileName.trim() ||
    fileName.length > 255 ||
    mimeType !== 'application/pdf' ||
    !Number.isInteger(sizeBytes) ||
    sizeBytes < 1 ||
    sizeBytes > 5 * 1024 * 1024 ||
    !validStoragePath
  ) {
    throw new ApiError(400, 'Los datos del candidato o del CV no son válidos.')
  }

  const { url } = getSupabaseConfiguration(env)
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new ApiError(
      503,
      'La persistencia de candidatos no está configurada en el servidor.',
    )
  }

  let response
  let createdDocuments
  const contentFingerprint = getContentFingerprint(extractedText)

  try {
    response = await fetchImpl(
      `${url}/rest/v1/rpc/save_candidate_document`,
      {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_recruiter_id: userId,
          p_full_name: candidateName.trim(),
          p_original_file_name: fileName.trim(),
          p_mime_type: mimeType,
          p_size_bytes: sizeBytes,
          p_storage_path: storagePath,
          p_extracted_text: extractedText,
          p_content_fingerprint: contentFingerprint,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    )
  } catch {
    throw new ApiError(502, 'No se pudo guardar el candidato y su CV en Supabase.')
  }

  if (!response.ok) {
    console.error(
      `Supabase rechazó la persistencia del CV con estado ${response.status}.`,
    )
    throw new ApiError(502, 'No se pudo guardar el candidato y su CV en Supabase.')
  }

  try {
    createdDocuments = await response.json()
  } catch {
    throw new ApiError(502, 'Supabase devolvió una respuesta inválida al guardar el CV.')
  }

  const savedCandidate = Array.isArray(createdDocuments)
    ? createdDocuments[0]
    : createdDocuments
  const candidateId = savedCandidate?.candidate_id
  const candidateDocumentId = savedCandidate?.candidate_document_id
  const reusedExisting = savedCandidate?.reused_existing
  if (typeof candidateDocumentId !== 'string' || !candidateDocumentId) {
    throw new ApiError(
      502,
      'Supabase no devolvió los identificadores del candidato y su CV.',
    )
  }

  if (typeof candidateId !== 'string' || !candidateId) {
    throw new ApiError(502, 'Supabase no devolvió el identificador del candidato.')
  }

  if (typeof reusedExisting !== 'boolean') {
    throw new ApiError(
      502,
      'Supabase no confirmó si se reutilizó o creó el CV.',
    )
  }

  return { candidateId, candidateDocumentId, reusedExisting }
}

const findCandidateDocument = async (userId, input, env, fetchImpl) => {
  const { extractedText } = input ?? {}
  if (
    typeof extractedText !== 'string' ||
    !extractedText.trim() ||
    extractedText.length > maxResumeLength
  ) {
    throw new ApiError(400, 'El texto del CV no es válido.')
  }

  const { url } = getSupabaseConfiguration(env)
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new ApiError(
      503,
      'La persistencia de candidatos no está configurada en el servidor.',
    )
  }

  let response
  try {
    response = await fetchImpl(
      `${url}/rest/v1/rpc/find_candidate_document_by_fingerprint`,
      {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_recruiter_id: userId,
          p_content_fingerprint: getContentFingerprint(extractedText),
          p_extracted_text: extractedText,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    )
  } catch {
    throw new ApiError(502, 'No se pudo buscar el CV en Supabase.')
  }

  if (!response.ok) {
    console.error(
      `Supabase rechazó la búsqueda de CV duplicado con estado ${response.status}.`,
    )
    throw new ApiError(502, 'No se pudo comprobar si el CV ya existe en Supabase.')
  }

  let matchingDocuments
  try {
    matchingDocuments = await response.json()
  } catch {
    throw new ApiError(
      502,
      'Supabase devolvió una respuesta inválida al buscar el CV.',
    )
  }

  const match = Array.isArray(matchingDocuments)
    ? matchingDocuments[0]
    : matchingDocuments
  if (!match) {
    return { found: false }
  }

  if (
    typeof match.candidate_id !== 'string' ||
    !match.candidate_id ||
    typeof match.candidate_document_id !== 'string' ||
    !match.candidate_document_id
  ) {
    throw new ApiError(
      502,
      'Supabase devolvió identificadores de CV inválidos.',
    )
  }

  return {
    found: true,
    candidateId: match.candidate_id,
    candidateDocumentId: match.candidate_document_id,
  }
}

const callAzureOpenAI = async (messages, env, fetchImpl) => {
  const { endpoint, key, deployment, apiVersion } =
    getAzureConfiguration(env)
  let response

  try {
    response = await fetchImpl(
      `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': key,
        },
        body: JSON.stringify({ messages }),
        signal: AbortSignal.timeout(60_000),
      },
    )
  } catch {
    throw new ApiError(502, 'No se pudo conectar con Azure OpenAI.')
  }

  if (!response.ok) {
    console.error(`Azure OpenAI respondió con estado ${response.status}.`)
    throw new ApiError(502, 'Azure OpenAI no pudo completar la solicitud.')
  }

  let data
  try {
    data = await response.json()
  } catch {
    throw new ApiError(502, 'Azure OpenAI devolvió una respuesta inválida.')
  }

  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new ApiError(502, 'Azure OpenAI no devolvió contenido.')
  }

  return content
}

const isSupportedJobUrl = (value) => {
  try {
    const url = new URL(value)
    const isHttp = url.protocol === 'https:' || url.protocol === 'http:'
    const hostname = url.hostname.toLowerCase()
    const isLinkedIn =
      (hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com')) &&
      url.pathname.startsWith('/jobs/')
    const isComputrabajo =
      (hostname === 'computrabajo.com' || hostname.endsWith('.computrabajo.com')) &&
      url.pathname.length > 1

    return isHttp && (isLinkedIn || isComputrabajo)
  } catch {
    return false
  }
}

const extractVisibleText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxSourceLength)

const isJobRequirements = (value) =>
  Boolean(
    value &&
      typeof value === 'object' &&
      typeof value.role === 'string' &&
      value.role.trim().length > 0 &&
      value.role.length <= 200 &&
      seniorities.has(value.seniority) &&
      Number.isInteger(value.seniorityPoints) &&
      value.seniorityPoints >= 1 &&
      value.seniorityPoints <= 10 &&
      Array.isArray(value.skills) &&
      value.skills.length > 0 &&
      value.skills.length <= 100 &&
      value.skills.every(
        (skill) =>
          skill &&
          typeof skill === 'object' &&
          typeof skill.name === 'string' &&
          skill.name.trim().length > 0 &&
          skill.name.length <= 100 &&
          Number.isInteger(skill.points) &&
          skill.points >= 1 &&
          skill.points <= 10,
      ),
  )

const isCandidateEvaluation = (value) =>
  Boolean(
    value &&
      typeof value === 'object' &&
      typeof value.candidateName === 'string' &&
      typeof value.earnedPoints === 'number' &&
      Number.isFinite(value.earnedPoints) &&
      value.earnedPoints >= 0 &&
      typeof value.totalPoints === 'number' &&
      Number.isFinite(value.totalPoints) &&
      value.totalPoints > 0 &&
      value.earnedPoints <= value.totalPoints &&
      (value.verdict === 'Apto' || value.verdict === 'No Apto') &&
      Array.isArray(value.strengths) &&
      value.strengths.every((item) => typeof item === 'string') &&
      Array.isArray(value.gaps) &&
      value.gaps.every((item) => typeof item === 'string'),
  )

const isUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )

const saveEvaluationRun = async (userId, input, env, fetchImpl) => {
  const {
    candidateDocumentId,
    candidateId,
    evaluation,
    positionId,
    requirements,
    resumeText,
  } = input ?? {}
  if (
    !isUuid(candidateDocumentId) ||
    !isUuid(candidateId) ||
    !isUuid(positionId) ||
    !isJobRequirements(requirements) ||
    typeof resumeText !== 'string' ||
    !resumeText.trim() ||
    resumeText.length > maxResumeLength ||
    !isCandidateEvaluation(evaluation) ||
    evaluation.candidateName.trim().length === 0 ||
    evaluation.candidateName.length > 200 ||
    evaluation.strengths.length > 100 ||
    evaluation.gaps.length > 100 ||
    [...evaluation.strengths, ...evaluation.gaps].some(
      (item) => item.length > 1000,
    )
  ) {
    throw new ApiError(400, 'Los datos del análisis no son válidos.')
  }

  const { url } = getSupabaseConfiguration(env)
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new ApiError(
      503,
      'La persistencia de evaluaciones no está configurada en el servidor.',
    )
  }

  let response
  try {
    response = await fetchImpl(`${url}/rest/v1/rpc/save_evaluation_run`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_recruiter_id: userId,
        p_candidate_id: candidateId,
        p_candidate_document_id: candidateDocumentId,
        p_position_id: positionId,
        p_earned_points: evaluation.earnedPoints,
        p_total_points: evaluation.totalPoints,
        p_verdict: evaluation.verdict,
        p_strengths: evaluation.strengths,
        p_gaps: evaluation.gaps,
        p_request_fingerprint: getEvaluationFingerprint(
          requirements,
          resumeText,
        ),
        p_evaluator_version: evaluatorVersion,
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new ApiError(502, 'No se pudo guardar el resultado del análisis en Supabase.')
  }

  if (!response.ok) {
    console.error(
      `Supabase rechazó la persistencia del análisis con estado ${response.status}.`,
    )
    throw new ApiError(
      502,
      'No se pudo guardar el resultado del análisis en Supabase. Verificá que la migración de historial esté aplicada.',
    )
  }

  let savedRuns
  try {
    savedRuns = await response.json()
  } catch {
    throw new ApiError(
      502,
      'Supabase devolvió una respuesta inválida al guardar el análisis.',
    )
  }
  const savedRun = Array.isArray(savedRuns) ? savedRuns[0] : savedRuns
  if (!isUuid(savedRun?.application_id) || !isUuid(savedRun?.evaluation_run_id)) {
    throw new ApiError(
      502,
      'Supabase no devolvió los identificadores del historial de análisis.',
    )
  }
  if (typeof savedRun.reused_existing !== 'boolean') {
    throw new ApiError(
      502,
      'Supabase no confirmó si reutilizó el resultado del análisis.',
    )
  }

  return {
    applicationId: savedRun.application_id,
    evaluationRunId: savedRun.evaluation_run_id,
    reusedExisting: savedRun.reused_existing,
  }
}

const findExistingEvaluationRun = async (
  userId,
  { candidateId, positionId, requirements, resumeText },
  env,
  fetchImpl,
) => {
  const { url } = getSupabaseConfiguration(env)
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new ApiError(
      503,
      'La consulta del historial no está configurada en el servidor.',
    )
  }

  let response
  try {
    response = await fetchImpl(`${url}/rest/v1/rpc/find_evaluation_run`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_recruiter_id: userId,
        p_candidate_id: candidateId,
        p_position_id: positionId,
        p_request_fingerprint: getEvaluationFingerprint(
          requirements,
          resumeText,
        ),
        p_evaluator_version: evaluatorVersion,
        p_requirements: requirements,
        p_resume_text: resumeText,
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new ApiError(502, 'No se pudo consultar el historial de análisis.')
  }

  if (!response.ok) {
    console.error(
      `Supabase rechazó la consulta del historial con estado ${response.status}.`,
    )
    throw new ApiError(
      502,
      'No se pudo consultar el historial. Verificá que las migraciones de CV e historial estén aplicadas.',
    )
  }

  let savedRuns
  try {
    savedRuns = await response.json()
  } catch {
    throw new ApiError(
      502,
      'Supabase devolvió una respuesta inválida al consultar el historial.',
    )
  }

  const savedRun = Array.isArray(savedRuns) ? savedRuns[0] : savedRuns
  if (!savedRun) {
    return null
  }
  if (
    typeof savedRun.candidate_name !== 'string' ||
    typeof savedRun.earned_points !== 'number' ||
    typeof savedRun.total_points !== 'number' ||
    (savedRun.verdict !== 'Apto' && savedRun.verdict !== 'No Apto') ||
    !Array.isArray(savedRun.strengths) ||
    !savedRun.strengths.every((item) => typeof item === 'string') ||
    !Array.isArray(savedRun.gaps) ||
    !savedRun.gaps.every((item) => typeof item === 'string') ||
    !isUuid(savedRun.evaluation_run_id)
  ) {
    throw new ApiError(
      502,
      'Supabase devolvió un resultado de análisis inválido.',
    )
  }

  return {
    candidateName: savedRun.candidate_name,
    earnedPoints: savedRun.earned_points,
    totalPoints: savedRun.total_points,
    verdict: savedRun.verdict,
    strengths: savedRun.strengths,
    gaps: savedRun.gaps,
    reusedExistingEvaluation: true,
  }
}

const parseModelJson = (content, message) => {
  try {
    return JSON.parse(content)
  } catch {
    throw new ApiError(502, message)
  }
}

export const createApiServer = ({
  env = process.env,
  fetchImpl = fetch,
} = {}) =>
  createServer(async (request, response) => {
    const origin = request.headers.origin
    const allowedOrigin = env.APP_ORIGIN ?? 'http://localhost:5173'

    if (request.method === 'OPTIONS') {
      sendJson(response, 204, {}, origin, allowedOrigin)
      return
    }

    if (request.method === 'GET' && request.url === '/health') {
      sendJson(response, 200, { status: 'ok' }, origin, allowedOrigin)
      return
    }

    if (request.method !== 'POST') {
      sendJson(response, 404, { error: 'Ruta no encontrada.' }, origin, allowedOrigin)
      return
    }

    try {
      const user = await requireAuthenticatedUser(request, env, fetchImpl)
      const body = await readRequestBody(request)

      if (request.url === '/api/candidates') {
        const candidate = await createCandidateDocument(
          user.id,
          body,
          env,
          fetchImpl,
        )
        sendJson(response, 201, candidate, origin, allowedOrigin)
        return
      }

      if (request.url === '/api/candidates/lookup') {
        const match = await findCandidateDocument(
          user.id,
          body,
          env,
          fetchImpl,
        )
        sendJson(response, 200, match, origin, allowedOrigin)
        return
      }

      if (request.url === '/api/evaluation-runs') {
        const savedRun = await saveEvaluationRun(user.id, body, env, fetchImpl)
        sendJson(response, 201, savedRun, origin, allowedOrigin)
        return
      }

      if (request.url === '/api/evaluate-candidate') {
        const { requirements, resumeText, positionId } = body ?? {}
        if (
          !isJobRequirements(requirements) ||
          typeof resumeText !== 'string' ||
          !resumeText.trim() ||
          resumeText.length > maxResumeLength ||
          !isUuid(positionId)
        ) {
          throw new ApiError(400, 'El puesto, los requisitos o el texto del CV no son válidos.')
        }

        const savedCandidate = await findCandidateDocument(
          user.id,
          { extractedText: resumeText },
          env,
          fetchImpl,
        )
        if (savedCandidate.found) {
          const previousEvaluation = await findExistingEvaluationRun(
            user.id,
            {
              candidateId: savedCandidate.candidateId,
              positionId,
              requirements,
              resumeText,
            },
            env,
            fetchImpl,
          )
          if (previousEvaluation) {
            sendJson(response, 200, previousEvaluation, origin, allowedOrigin)
            return
          }
        }

        const content = await callAzureOpenAI(
          [
            {
              role: 'system',
              content:
                'Sos un evaluador de RRHH. Evaluá el CV del candidato frente a los JobRequirements. Cada habilidad de skills tiene un peso points independiente entre 1 y 10; el seniority tiene seniorityPoints. Para seniority, analizá únicamente las experiencias laborales cuyo título corresponda al role solicitado; no uses la experiencia total de otros roles, educación ni certificaciones. Usá estos rangos: Trainee hasta 1 año, Junior más de 1 y hasta 3 años, Semi Senior más de 3 y hasta 5 años, Senior más de 5 y hasta 8 años, Lead más de 8 años. Si el CV declara un seniority pero no informa años de experiencia relacionada con el role, usá ese nivel. Un candidato con un nivel superior al requerido está calificado igualmente y debe sumar los seniorityPoints; no lo penalices por sobrecalificación. Un candidato con un nivel inferior no cumple el seniority. Sumá los pesos de todas las habilidades y del seniority para obtener totalPoints, sin aplicar un límite máximo al total. earnedPoints debe ser la suma de los pesos de los requisitos cumplidos. Respondé Apto si la proporción de puntos obtenidos es igual o mayor al 70%, y No Apto si es menor. Para cada fortaleza, indicá la habilidad, el nivel o tipo de experiencia y la evidencia concreta encontrada en el CV; no escribas únicamente el nombre de la habilidad. Para cada brecha, indicá la habilidad faltante y explicá qué evidencia no aparece o qué requisito no queda acreditado. No inventes años, proyectos, responsabilidades ni tecnologías. Evitá duplicar una misma habilidad entre fortalezas y brechas. Respondé exclusivamente en formato JSON válido que cumpla la interfaz CandidateEvaluation: {"candidateName": string, "earnedPoints": number, "totalPoints": number, "verdict": "Apto" | "No Apto", "strengths": string[], "gaps": string[]}.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                jobRequirements: requirements,
                candidateResume: resumeText,
              }),
            },
          ],
          env,
          fetchImpl,
        )
        const evaluation = parseModelJson(
          content,
          'Azure OpenAI devolvió un JSON inválido.',
        )

        if (!isCandidateEvaluation(evaluation)) {
          throw new ApiError(502, 'La respuesta de evaluación tiene un formato inválido.')
        }

        sendJson(
          response,
          200,
          { ...evaluation, reusedExistingEvaluation: false },
          origin,
          allowedOrigin,
        )
        return
      }

      if (request.url === '/api/import-job-requirements') {
        const sourceUrl = body?.sourceUrl
        if (typeof sourceUrl !== 'string' || !isSupportedJobUrl(sourceUrl)) {
          throw new ApiError(
            400,
            'La URL debe ser una oferta pública válida de LinkedIn o Computrabajo.',
          )
        }

        let sourceResponse
        try {
          sourceResponse = await fetchImpl(sourceUrl, {
            headers: { 'User-Agent': 'Talentiq-MVP/1.0' },
            redirect: 'error',
            signal: AbortSignal.timeout(15_000),
          })
        } catch {
          throw new ApiError(502, 'No se pudo acceder al contenido de la oferta.')
        }

        if (!sourceResponse.ok) {
          throw new ApiError(
            502,
            'El sitio de la oferta no permitió acceder a su contenido.',
          )
        }

        const sourceText = extractVisibleText(await sourceResponse.text())
        if (!sourceText) {
          throw new ApiError(422, 'No se encontró contenido público para extraer requisitos.')
        }

        const content = await callAzureOpenAI(
          [
            {
              role: 'system',
              content:
                'Sos un extractor de requisitos laborales. Analizá todo el contenido disponible de la oferta, especialmente las secciones de requisitos, responsabilidades, conocimientos, tecnologías y skills. Extraé en skills todas las tecnologías requeridas o mencionadas, incluyendo lenguajes de programación, frameworks, librerías, herramientas, bases de datos, plataformas y metodologías. Conservá los nombres técnicos tal como aparecen y normalizá solo variantes evidentes como JS/JavaScript o TS/TypeScript. No devuelvas skills vacío si el texto contiene tecnologías identificables. Respondé exclusivamente con JSON válido y sin markdown con esta forma: {"sourceUrl": string, "requirements": {"role": string, "skills": string[], "seniority": string}}.',
            },
            {
              role: 'user',
              content: JSON.stringify({ sourceUrl, sourceText }),
            },
          ],
          env,
          fetchImpl,
        )
        const imported = parseModelJson(
          content,
          'Azure OpenAI devolvió un JSON inválido.',
        )

        if (
          !imported ||
          typeof imported !== 'object' ||
          imported.sourceUrl !== sourceUrl ||
          typeof imported.requirements?.role !== 'string' ||
          typeof imported.requirements?.seniority !== 'string' ||
          !Array.isArray(imported.requirements?.skills) ||
          !imported.requirements.skills.every(
            (skill) => typeof skill === 'string',
          )
        ) {
          throw new ApiError(502, 'La respuesta no cumple el contrato de importación.')
        }

        sendJson(response, 200, imported, origin, allowedOrigin)
        return
      }

      sendJson(response, 404, { error: 'Ruta no encontrada.' }, origin, allowedOrigin)
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 500
      const message =
        error instanceof ApiError
          ? error.message
          : 'No se pudo completar la solicitud.'
      if (status === 500) {
        console.error('Error procesando la solicitud de Talentiq.', error)
      }
      sendJson(response, status, { error: message }, origin, allowedOrigin)
    }
  })

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3001)
  createApiServer().listen(port, () => {
    console.log(`Talentiq API escuchando en el puerto ${port}`)
  })
}
