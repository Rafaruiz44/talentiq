import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createApiServer } from './server.mjs'

const serverEnv = {
  SUPABASE_URL: 'https://supabase.example.com',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-server-only-service-role-key',
  AZURE_OPENAI_ENDPOINT: 'https://azure.example.com',
  AZURE_OPENAI_KEY: 'test-server-only-key',
  AZURE_OPENAI_DEPLOYMENT: 'test-deployment',
  AZURE_OPENAI_API_VERSION: 'test-version',
}

let apiServer
let apiUrl
let azureCalls
let candidateWrites

before(async () => {
  azureCalls = 0
  candidateWrites = []
  apiServer = createApiServer({
    env: serverEnv,
    fetchImpl: async (input, init) => {
      if (String(input).endsWith('/auth/v1/user')) {
        if (init.headers.Authorization !== 'Bearer valid-access-token') {
          return Response.json({ message: 'Invalid token' }, { status: 401 })
        }

        assert.equal(init.headers.apikey, serverEnv.SUPABASE_ANON_KEY)
        return Response.json({ id: 'authenticated-recruiter' })
      }

      if (String(input).includes('/rest/v1/rpc/save_candidate_document')) {
        assert.equal(init.headers.apikey, serverEnv.SUPABASE_SERVICE_ROLE_KEY)
        candidateWrites.push(JSON.parse(init.body))
        return Response.json(
          [{ candidate_id: 'candidate-1', candidate_document_id: 'document-1' }],
          { status: 200 },
        )
      }

      azureCalls += 1
      assert.equal(init.headers['api-key'], serverEnv.AZURE_OPENAI_KEY)
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                candidateName: 'Candidate',
                earnedPoints: 10,
                totalPoints: 10,
                verdict: 'Apto',
                strengths: ['React experience'],
                gaps: [],
              }),
            },
          },
        ],
      })
    },
  })
  await new Promise((resolve) => apiServer.listen(0, '127.0.0.1', resolve))
  apiUrl = `http://127.0.0.1:${apiServer.address().port}`
})

after(async () => {
  await new Promise((resolve, reject) =>
    apiServer.close((error) => (error ? reject(error) : resolve())),
  )
})

const validRequest = {
  requirements: {
    role: 'Frontend Developer',
    seniority: 'Semi Senior',
    seniorityPoints: 5,
    skills: [{ name: 'React', points: 5 }],
  },
  resumeText: 'Candidate with React experience',
}

const validCandidateRequest = {
  candidateName: 'Candidato de prueba',
  extractedText: 'Experiencia con React',
  fileName: 'candidato.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  storagePath:
    'authenticated-recruiter/11111111-1111-4111-8111-111111111111/resume.pdf',
}

test('requires a valid Supabase access token before evaluating a CV', async () => {
  const response = await fetch(`${apiUrl}/api/evaluate-candidate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validRequest),
  })

  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), {
    error: 'Iniciá sesión para realizar esta operación.',
  })
  assert.equal(azureCalls, 0)
})

test('rejects an invalid Supabase token without calling Azure OpenAI', async () => {
  const response = await fetch(`${apiUrl}/api/evaluate-candidate`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer invalid-access-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(validRequest),
  })

  assert.equal(response.status, 401)
  assert.equal(azureCalls, 0)
})

test('rejects invalid evaluation input before calling Azure OpenAI', async () => {
  const response = await fetch(`${apiUrl}/api/evaluate-candidate`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer valid-access-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...validRequest,
      requirements: { ...validRequest.requirements, skills: [] },
    }),
  })

  assert.equal(response.status, 400)
  assert.equal(azureCalls, 0)
})

test('validates the Supabase session before calling Azure with server credentials', async () => {
  const response = await fetch(`${apiUrl}/api/evaluate-candidate`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer valid-access-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(validRequest),
  })

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    candidateName: 'Candidate',
    earnedPoints: 10,
    totalPoints: 10,
    verdict: 'Apto',
    strengths: ['React experience'],
    gaps: [],
  })
  assert.equal(azureCalls, 1)
})

test('requires authentication for the Azure-backed offer import route too', async () => {
  const response = await fetch(`${apiUrl}/api/import-job-requirements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceUrl: 'https://www.linkedin.com/jobs/view/123' }),
  })

  assert.equal(response.status, 401)
  assert.equal(azureCalls, 1)
})

test('rejects candidate documents whose storage path belongs to another recruiter', async () => {
  const response = await fetch(`${apiUrl}/api/candidates`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer valid-access-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...validCandidateRequest,
      storagePath:
        'another-recruiter/11111111-1111-4111-8111-111111111111/resume.pdf',
    }),
  })

  assert.equal(response.status, 400)
  assert.equal(candidateWrites.length, 0)
})

test('saves a candidate and processed CV text under the authenticated recruiter', async () => {
  const response = await fetch(`${apiUrl}/api/candidates`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer valid-access-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(validCandidateRequest),
  })

  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), {
    candidateId: 'candidate-1',
    candidateDocumentId: 'document-1',
  })
  assert.deepEqual(candidateWrites.at(-1), {
    p_recruiter_id: 'authenticated-recruiter',
    p_full_name: 'Candidato de prueba',
    p_original_file_name: 'candidato.pdf',
    p_mime_type: 'application/pdf',
    p_size_bytes: 1024,
    p_storage_path: validCandidateRequest.storagePath,
    p_extracted_text: 'Experiencia con React',
  })
})
