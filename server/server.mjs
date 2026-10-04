import { createServer } from 'node:http'
import { pathToFileURL } from 'node:url'

const maxBodyLength = 750_000
const maxSourceLength = 500_000
const maxResumeLength = 600_000
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
      await requireAuthenticatedUser(request, env, fetchImpl)
      const body = await readRequestBody(request)

      if (request.url === '/api/evaluate-candidate') {
        const { requirements, resumeText } = body ?? {}
        if (
          !isJobRequirements(requirements) ||
          typeof resumeText !== 'string' ||
          !resumeText.trim() ||
          resumeText.length > maxResumeLength
        ) {
          throw new ApiError(400, 'Los requisitos o el texto del CV no son válidos.')
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

        sendJson(response, 200, evaluation, origin, allowedOrigin)
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
