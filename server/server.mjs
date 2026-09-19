import { createServer } from 'node:http'

const port = Number(process.env.PORT ?? 3001)
const maxBodyLength = 10_000
const maxSourceLength = 500_000

const sendJson = (response, statusCode, body) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  })
  response.end(JSON.stringify(body))
}

const readRequestBody = async (request) => {
  let body = ''

  for await (const chunk of request) {
    body += chunk

    if (body.length > maxBodyLength) {
      throw new Error('El cuerpo de la solicitud es demasiado grande.')
    }
  }

  return JSON.parse(body)
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

const getAzureEvaluation = async (sourceUrl, sourceText) => {
  const endpoint = process.env.VITE_AZURE_OPENAI_ENDPOINT
  const key = process.env.VITE_AZURE_OPENAI_KEY
  const deployment = process.env.VITE_AZURE_OPENAI_DEPLOYMENT
  const apiVersion = process.env.VITE_AZURE_OPENAI_API_VERSION

  if (!endpoint || !key || !deployment || !apiVersion) {
    throw new Error('Faltan variables server-side de Azure OpenAI.')
  }

  const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': key,
    },
    body: JSON.stringify({
      messages: [
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
    }),
  })

  if (!response.ok) {
    const details = await response.text()
    console.error('Detalle error Azure:', details)
    throw new Error(`Azure OpenAI error ${response.status}: ${details}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content

  if (typeof content !== 'string') {
    throw new Error('Azure OpenAI no devolvió contenido.')
  }

  let parsed

  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('Azure OpenAI devolvió un JSON inválido.')
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof parsed.sourceUrl !== 'string' ||
    typeof parsed.requirements !== 'object' ||
    parsed.requirements === null ||
    typeof parsed.requirements.role !== 'string' ||
    typeof parsed.requirements.seniority !== 'string' ||
    !Array.isArray(parsed.requirements.skills) ||
    !parsed.requirements.skills.every((skill) => typeof skill === 'string')
  ) {
    throw new Error('La respuesta no cumple el contrato JobRequirementsImport.')
  }

  return parsed
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {})
    return
  }

  if (
    request.method !== 'POST' ||
    request.url !== '/api/import-job-requirements'
  ) {
    sendJson(response, 404, { error: 'Ruta no encontrada.' })
    return
  }

  try {
    const body = await readRequestBody(request)
    const sourceUrl = body?.sourceUrl

    if (typeof sourceUrl !== 'string' || !isSupportedJobUrl(sourceUrl)) {
      sendJson(response, 400, {
        error:
          'La URL debe ser una oferta pública válida de LinkedIn o Computrabajo.',
      })
      return
    }

    const sourceResponse = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Talentiq-MVP/1.0',
      },
    })

    if (!sourceResponse.ok) {
      sendJson(response, sourceResponse.status, {
        error: 'LinkedIn no permitió acceder al contenido de la oferta.',
      })
      return
    }

    const sourceText = extractVisibleText(await sourceResponse.text())

    if (!sourceText) {
      sendJson(response, 422, {
        error: 'No se encontró contenido público para extraer requisitos.',
      })
      return
    }

    sendJson(response, 200, await getAzureEvaluation(sourceUrl, sourceText))
  } catch (error) {
    console.error('Error importando requisitos:', error)
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Error interno.',
    })
  }
})

server.listen(port, () => {
  console.log(`Talentiq API escuchando en http://localhost:${port}`)
})
