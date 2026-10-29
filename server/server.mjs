import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const maxBodyLength = 3_000_000
const maxSourceLength = 500_000
const maxResumeLength = 600_000
const evaluatorVersion = 'candidate-evaluation-v19'
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
          acceptanceThreshold: requirements.acceptanceThreshold,
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
  url: (env.SUPABASE_URL ?? '').replace(/\/$/, ''),
  anonKey: env.SUPABASE_ANON_KEY,
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
    candidateEmail,
    candidatePhone,
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

  if (
    (typeof candidateEmail === 'string' && candidateEmail.trim()) ||
    (typeof candidatePhone === 'string' && candidatePhone.trim())
  ) {
    try {
      const updatePayload = {}
      if (typeof candidateEmail === 'string' && candidateEmail.trim()) {
        updatePayload.email = candidateEmail.trim()
      }
      if (typeof candidatePhone === 'string' && candidatePhone.trim()) {
        updatePayload.phone = candidatePhone.trim()
      }
      const patchRes = await fetchImpl(
        `${url}/rest/v1/candidates?id=eq.${candidateId}&recruiter_id=eq.${userId}`,
        {
          method: 'PATCH',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updatePayload),
        },
      )
      if (!patchRes.ok && updatePayload.phone && updatePayload.email) {
        await fetchImpl(
          `${url}/rest/v1/candidates?id=eq.${candidateId}&recruiter_id=eq.${userId}`,
          {
            method: 'PATCH',
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: updatePayload.email }),
          },
        )
      }
    } catch (contactError) {
      console.warn('No se pudo guardar datos de contacto en Supabase:', contactError)
    }
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
      Number.isInteger(value.acceptanceThreshold) &&
      value.acceptanceThreshold >= 50 &&
      value.acceptanceThreshold <= 100 &&
      value.acceptanceThreshold % 5 === 0 &&
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
      (value.experienceArea === undefined ||
        (typeof value.experienceArea === 'string' &&
          value.experienceArea.trim().length > 0)) &&
      (value.experienceAreas === undefined ||
        (Array.isArray(value.experienceAreas) &&
          value.experienceAreas.length > 0 &&
          value.experienceAreas.every(
            (area) => typeof area === 'string' && area.trim().length > 0,
          ))) &&
      (value.seniorityAnalysis === undefined ||
        (typeof value.seniorityAnalysis === 'object' &&
          value.seniorityAnalysis !== null &&
          Array.isArray(value.seniorityAnalysis.relevantExperiences) &&
          value.seniorityAnalysis.relevantExperiences.every(
            (item) => typeof item === 'string',
          ) &&
          (value.seniorityAnalysis.relevantYears === null ||
            typeof value.seniorityAnalysis.relevantYears === 'number') &&
          (value.seniorityAnalysis.detectedLevel === null ||
            typeof value.seniorityAnalysis.detectedLevel === 'string') &&
          typeof value.seniorityAnalysis.explanation === 'string')) &&
      (value.roleArea === undefined ||
        (typeof value.roleArea === 'string' && value.roleArea.trim().length > 0)) &&
      (value.seniorityMatchesRole === undefined ||
        typeof value.seniorityMatchesRole === 'boolean') &&
      (value.candidateEmail === undefined ||
        value.candidateEmail === null ||
        typeof value.candidateEmail === 'string') &&
      (value.candidatePhone === undefined ||
        value.candidatePhone === null ||
        typeof value.candidatePhone === 'string') &&
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
      value.gaps.every((item) => typeof item === 'string') &&
      Array.isArray(value.interviewQuestions) &&
      value.interviewQuestions.every((item) => typeof item === 'string') &&
      (value.verdict === 'Apto'
        ? value.interviewQuestions.length === 3
        : value.interviewQuestions.length === 0),
  )

const isUuid = (value) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )

const normalizeEvaluationText = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const normalizeEvaluationScore = (evaluation, requirements) => {
  if (evaluation.gaps.length === 0 && evaluation.seniorityMatchesRole !== false) {
    return evaluation
  }

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
  const getSkillVariants = (value) => {
    const normalized = normalizeEvaluationText(value)
    const aliasGroup = skillAliasGroups.find((group) =>
      group.includes(normalized),
    )
    return aliasGroup ?? [normalized]
  }
  const hasSkillEvidence = (skill, entries) => {
    const skillVariants = getSkillVariants(skill.name)
    return entries.some((entry) => {
      const normalizedEntry = normalizeEvaluationText(entry)
      return skillVariants.some((variant) => normalizedEntry.includes(variant))
    })
  }
  const isSeniorityEntry = (entry) => {
    const normalizedEntry = normalizeEvaluationText(entry)
    return [
      'seniority',
      'trainee',
      'junior',
      'semi senior',
      'senior',
      'lead',
      normalizeEvaluationText(requirements.seniority),
    ].some((term) => normalizedEntry.includes(term))
  }
  const hasSeniorityEvidence = evaluation.seniorityMatchesRole === true
  const supportedPoints = requirements.skills
    .filter((skill) => hasSkillEvidence(skill, evaluation.strengths))
    .reduce((total, skill) => total + skill.points, 0)
  const verifiedEarnedPoints =
    supportedPoints + (hasSeniorityEvidence ? requirements.seniorityPoints : 0)
  const seniorityGap =
    evaluation.seniorityMatchesRole === false
      ? `Seniority no aplicable: experiencia inferida en ${(evaluation.experienceAreas ?? [evaluation.experienceArea ?? 'otra área profesional']).join(', ')}; el puesto requiere el área de ${evaluation.roleArea ?? `"${requirements.role}"`}.`
      : null

  return {
    ...evaluation,
    strengths:
      evaluation.seniorityMatchesRole === false
        ? evaluation.strengths.filter((strength) => !isSeniorityEntry(strength))
        : evaluation.strengths,
    gaps:
      seniorityGap && !evaluation.gaps.some((gap) => normalizeEvaluationText(gap).includes('seniority'))
        ? [...evaluation.gaps, seniorityGap]
        : evaluation.gaps,
    earnedPoints: Math.min(verifiedEarnedPoints, evaluation.totalPoints),
  }
}

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
    ) ||
    evaluation.interviewQuestions.some(
      (item) => !item.trim() || item.length > 1000,
    )
  ) {
    throw new ApiError(400, 'Los datos del análisis no son válidos.')
  }

  const scoredEvaluation = normalizeEvaluationScore(evaluation, requirements)
  const calculatedVerdict =
    (scoredEvaluation.earnedPoints / scoredEvaluation.totalPoints) * 100 >=
    requirements.acceptanceThreshold
      ? 'Apto'
      : 'No Apto'
  let normalizedEvaluation = {
    ...scoredEvaluation,
    verdict: calculatedVerdict,
    interviewQuestions:
      calculatedVerdict === 'Apto' ? evaluation.interviewQuestions : [],
  }

  if (
    calculatedVerdict === 'Apto' &&
    normalizedEvaluation.interviewQuestions.length !== 3
  ) {
    normalizedEvaluation = {
      ...normalizedEvaluation,
      interviewQuestions: await generateInterviewQuestions(
        requirements,
        resumeText,
        scoredEvaluation.strengths,
        scoredEvaluation.gaps,
        env,
        fetchImpl,
      ),
    }
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
        p_earned_points: normalizedEvaluation.earnedPoints,
        p_total_points: normalizedEvaluation.totalPoints,
        p_verdict: normalizedEvaluation.verdict,
        p_strengths: normalizedEvaluation.strengths,
        p_gaps: normalizedEvaluation.gaps,
        p_interview_questions: normalizedEvaluation.interviewQuestions,
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
    const errorBody = await response.text().catch(() => '')
    console.error(
      `Supabase rechazó la persistencia del análisis con estado ${response.status}: ${errorBody.slice(
        0,
        1000,
      )}`,
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
    earnedPoints: normalizedEvaluation.earnedPoints,
    totalPoints: normalizedEvaluation.totalPoints,
    verdict: normalizedEvaluation.verdict,
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
    !Array.isArray(savedRun.interview_questions) ||
    !savedRun.interview_questions.every((item) => typeof item === 'string') ||
    (savedRun.verdict === 'Apto'
      ? savedRun.interview_questions.length !== 0 &&
        savedRun.interview_questions.length !== 3
      : savedRun.interview_questions.length !== 0) ||
    !isUuid(savedRun.evaluation_run_id)
  ) {
    throw new ApiError(
      502,
      'Supabase devolvió un resultado de análisis inválido.',
    )
  }

  const scoredSavedRun = normalizeEvaluationScore(
    {
      earnedPoints: savedRun.earned_points,
      totalPoints: savedRun.total_points,
      strengths: savedRun.strengths,
      gaps: savedRun.gaps,
    },
    requirements,
  )
  const calculatedVerdict =
    (scoredSavedRun.earnedPoints / scoredSavedRun.totalPoints) * 100 >=
    requirements.acceptanceThreshold
      ? 'Apto'
      : 'No Apto'

  let interviewQuestions = []
  let reusedExisting = true

  if (calculatedVerdict === 'Apto') {
    if (
      Array.isArray(savedRun.interview_questions) &&
      savedRun.interview_questions.length === 3
    ) {
      interviewQuestions = savedRun.interview_questions
    } else {
      interviewQuestions = await generateInterviewQuestions(
        requirements,
        resumeText,
        savedRun.strengths,
        savedRun.gaps,
        env,
        fetchImpl,
      )
      reusedExisting = false
    }
  }

  return {
    candidateName: savedRun.candidate_name,
    earnedPoints: scoredSavedRun.earnedPoints,
    totalPoints: scoredSavedRun.totalPoints,
    verdict: calculatedVerdict,
    strengths: savedRun.strengths,
    gaps: savedRun.gaps,
    interviewQuestions,
    reusedExistingEvaluation: reusedExisting,
  }
}

const generateInterviewQuestions = async (
  requirements,
  resumeText,
  strengths,
  gaps,
  env,
  fetchImpl,
) => {
  const content = await callAzureOpenAI(
    [
      {
        role: 'system',
        content:
          `Sos un entrevistador técnico y evaluador de RRHH. Para el candidato que resulta Apto para la posición "${requirements.role}" (${requirements.seniority}), redactá exactamente 3 preguntas de entrevista profesionales, profundas y contextualizadas basadas en sus fortalezas, brechas y requisitos del puesto. Respondé exclusivamente en formato JSON válido: {"interviewQuestions": [string, string, string]}.`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          role: requirements.role,
          seniority: requirements.seniority,
          skills: requirements.skills,
          strengths,
          gaps,
          resumeExcerpt: resumeText.slice(0, 3000),
        }),
      },
    ],
    env,
    fetchImpl,
  )
  const parsed = parseModelJson(
    content,
    'Azure OpenAI devolvió un formato inválido para las preguntas de entrevista.',
  )
  if (
    Array.isArray(parsed?.interviewQuestions) &&
    parsed.interviewQuestions.length === 3 &&
    parsed.interviewQuestions.every(
      (q) => typeof q === 'string' && q.trim().length > 0,
    )
  ) {
    return parsed.interviewQuestions.map((q) => q.trim())
  }
  throw new ApiError(
    502,
    'No se pudieron generar las 3 preguntas de entrevista requeridas.',
  )
}

const parseModelJson = (content, message) => {
  try {
    return JSON.parse(content)
  } catch {
    throw new ApiError(502, message)
  }
}

export const createApiRequestHandler = ({
  env = process.env,
  fetchImpl = fetch,
} = {}) => async (request, response) => {
    const requestPath = new URL(request.url, 'http://localhost').pathname
    const routePath = requestPath.startsWith('/api/')
      ? requestPath.slice('/api'.length)
      : requestPath
    const origin = request.headers.origin
    const allowedOrigin = env.APP_ORIGIN ?? 'http://localhost:5173'

    if (request.method === 'OPTIONS') {
      sendJson(response, 204, {}, origin, allowedOrigin)
      return
    }

    if (request.method === 'GET' && routePath === '/health') {
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

      if (routePath === '/candidates') {
        const candidate = await createCandidateDocument(
          user.id,
          body,
          env,
          fetchImpl,
        )
        sendJson(response, 201, candidate, origin, allowedOrigin)
        return
      }

      if (routePath === '/candidates/lookup') {
        const match = await findCandidateDocument(
          user.id,
          body,
          env,
          fetchImpl,
        )
        sendJson(response, 200, match, origin, allowedOrigin)
        return
      }

      if (routePath === '/evaluation-runs') {
        const savedRun = await saveEvaluationRun(user.id, body, env, fetchImpl)
        sendJson(response, 201, savedRun, origin, allowedOrigin)
        return
      }

      if (routePath === '/evaluate-candidate') {
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
                `Sos un evaluador de RRHH. Evaluá el CV frente a los JobRequirements. Inferí el área objetivo roleArea usando el nombre del puesto y, obligatoriamente, sus habilidades y responsabilidades. Inferí todas las áreas profesionales relevantes del candidato en experienceAreas, usando tareas, responsabilidades, tecnologías, herramientas y resultados del CV; experienceArea debe ser el área principal por compatibilidad con el puesto. No dependas únicamente de títulos. Una especialización es compatible con su área general: "Desarrollo de software" es compatible con "Desarrollo de software backend", "Java backend" y "Desarrollo de APIs". Si el candidato trabajó en varias áreas, no lo descartes: seniorityMatchesRole=true si al menos una experiencia laboral relevante pertenece al roleArea o a una especialización compatible, aunque también tenga experiencia en otras áreas. Devolvé áreas breves y específicas. Para diagnosticar la decisión, devolvé seniorityAnalysis con relevantExperiences (lista de experiencias concretas consideradas compatibles), relevantYears (años sumados únicamente de esas experiencias), detectedLevel (nivel calculado con esos años), academicProjects (lista de proyectos académicos o personales relacionados con el área) y explanation (explicación breve de por qué el seniority coincide o no). Regla obligatoria según el nivel: si el seniority requerido es Trainee, los proyectos académicos o personales relacionados con el roleArea cuentan como experiencia válida y deben incluirse en relevantExperiences; podés usar su duración o evidencia concreta para validar Trainee. Si el seniority requerido es Junior, Semi Senior, Senior o Lead, calculá el nivel únicamente con tiempo de trabajo formal en experiencias laborales compatibles; no sumes proyectos académicos, personales, cursos ni educación para esos niveles, pero informá los proyectos relacionados en academicProjects y explicá que aportan contexto aunque no sumen años laborales. Usá estos rangos: Trainee hasta 1 año, Junior más de 1 y hasta 3 años, Semi Senior más de 3 y hasta 5 años, Senior más de 5 y hasta 8 años, Lead más de 8 años. Un nivel superior al requerido cumple; uno inferior no cumple. Antes de responder, verificá: (1) roleArea; (2) experienceAreas; (3) experiencias laborales compatibles; (4) proyectos académicos/personales compatibles; (5) fuente de experiencia permitida por el seniority requerido; (6) años relevantes; (7) nivel detectado; (8) seniorityMatchesRole. Si el nivel requerido es Trainee y existe un proyecto académico o personal relacionado con el roleArea, seniorityMatchesRole debe ser true. Para niveles superiores, solo devolvé true si el tiempo de trabajo formal compatible alcanza el nivel requerido. No devuelvas false por diferencias de granularidad entre un área general y una especialización. Si no se alcanza el nivel, explicalo en seniorityAnalysis.explanation y gaps. Para CADA habilidad y para el seniority indicá exactamente una clasificación en strengths o gaps. earnedPoints debe ser exclusivamente la suma de habilidades en strengths y seniority en strengths cuando seniorityMatchesRole sea true. totalPoints debe ser la suma de todos los pesos de skills y seniority. Respondé Apto si earnedPoints / totalPoints * 100 es igual o mayor al ${requirements.acceptanceThreshold}%, y No Apto si es menor. Si el veredicto es Apto, generá exactamente 3 preguntas relevantes; si es No Apto, interviewQuestions debe ser []. No inventes años, proyectos, responsabilidades ni tecnologías. Extraé candidateEmail y candidatePhone si están presentes; de lo contrario null. Respondé exclusivamente JSON válido con la interfaz CandidateEvaluation: {"candidateName": string, "candidateEmail": string | null, "candidatePhone": string | null, "experienceArea": string, "experienceAreas": string[], "roleArea": string, "seniorityMatchesRole": boolean, "seniorityAnalysis": {"relevantExperiences": string[], "relevantYears": number | null, "detectedLevel": string | null, "academicProjects": string[], "explanation": string}, "earnedPoints": number, "totalPoints": number, "verdict": "Apto" | "No Apto", "strengths": string[], "gaps": string[], "interviewQuestions": string[]}.`,
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

        const scoredEvaluation = normalizeEvaluationScore(
          evaluation,
          requirements,
        )
        const calculatedVerdict =
          (scoredEvaluation.earnedPoints / scoredEvaluation.totalPoints) * 100 >=
          requirements.acceptanceThreshold
            ? 'Apto'
            : 'No Apto'

        let interviewQuestions =
          calculatedVerdict === 'Apto' ? evaluation.interviewQuestions : []

        if (calculatedVerdict === 'Apto' && interviewQuestions.length !== 3) {
          interviewQuestions = await generateInterviewQuestions(
            requirements,
            resumeText,
            scoredEvaluation.strengths,
            scoredEvaluation.gaps,
            env,
            fetchImpl,
          )
        }

        const normalizedEvaluation = {
          ...scoredEvaluation,
          verdict: calculatedVerdict,
          interviewQuestions,
        }

        sendJson(
          response,
          200,
          { ...normalizedEvaluation, reusedExistingEvaluation: false },
          origin,
          allowedOrigin,
        )
        return
      }

      if (routePath === '/import-job-requirements') {
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
  }

export const createApiServer = (options = {}) =>
  createServer(createApiRequestHandler(options))

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3001)
  createApiServer().listen(port, () => {
    console.log(`Talentiq API escuchando en el puerto ${port}`)
  })
}
