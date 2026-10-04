import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
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

const expectedFingerprint = (text) =>
  createHash('md5').update(text, 'utf8').digest('hex')
const getEvaluationFingerprint = (requirements, resumeText) =>
  createHash('sha256')
    .update(
      JSON.stringify({
        evaluatorVersion: 'candidate-evaluation-v1',
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

let apiServer
let apiUrl
let azureCalls
let candidateWrites
let candidateLookups
let evaluationWrites
let evaluationLookups

before(async () => {
  azureCalls = 0
  candidateWrites = []
  candidateLookups = []
  evaluationWrites = []
  evaluationLookups = []
  apiServer = createApiServer({
    env: serverEnv,
    fetchImpl: async (input, init) => {
      if (String(input).endsWith('/auth/v1/user')) {
        if (
          init.headers.Authorization === 'Bearer evaluation-test-token' ||
          init.headers.Authorization === 'Bearer candidate-lookup-test-token'
        ) {
          assert.equal(init.headers.apikey, serverEnv.SUPABASE_ANON_KEY)
          return Response.json({ id: 'authenticated-recruiter' })
        }

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
          [
            {
              candidate_id: 'candidate-1',
              candidate_document_id: 'document-1',
              reused_existing: false,
            },
          ],
          { status: 200 },
        )
      }

      if (
        String(input).includes(
          '/rest/v1/rpc/find_candidate_document_by_fingerprint',
        )
      ) {
        assert.equal(init.headers.apikey, serverEnv.SUPABASE_SERVICE_ROLE_KEY)
        const lookup = JSON.parse(init.body)
        candidateLookups.push(lookup)
        return Response.json(
          ['Existing candidate resume', 'Legacy candidate resume'].includes(
            lookup.p_extracted_text,
          )
            ? [
                {
                  candidate_id: '66666666-6666-4666-8666-666666666666',
                  candidate_document_id:
                    '88888888-8888-4888-8888-888888888888',
                },
              ]
            : [],
          { status: 200 },
        )
      }

      if (String(input).includes('/rest/v1/rpc/save_evaluation_run')) {
        assert.equal(init.headers.apikey, serverEnv.SUPABASE_SERVICE_ROLE_KEY)
        evaluationWrites.push(JSON.parse(init.body))
        return Response.json(
          [
            {
              application_id: '11111111-1111-4111-8111-111111111111',
              evaluation_run_id: '22222222-2222-4222-8222-222222222222',
              reused_existing: false,
            },
          ],
          { status: 200 },
        )
      }

      if (String(input).includes('/rest/v1/rpc/find_evaluation_run')) {
        const lookup = JSON.parse(init.body)
        evaluationLookups.push(lookup)
        return Response.json(
          lookup.p_candidate_id === '66666666-6666-4666-8666-666666666666' &&
            ((lookup.p_resume_text === 'Existing candidate resume' &&
              lookup.p_request_fingerprint ===
                getEvaluationFingerprint(
                  validRequest.requirements,
                  'Existing candidate resume',
                )) ||
              lookup.p_resume_text === 'Legacy candidate resume')
            ? [
                {
                  candidate_name: 'Existing candidate',
                  earned_points: 10,
                  total_points: 10,
                  verdict: 'Apto',
                  strengths: ['Existing result'],
                  gaps: [],
                  evaluation_run_id:
                    '77777777-7777-4777-8777-777777777777',
                },
              ]
            : [],
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
  positionId: '55555555-5555-4555-8555-555555555555',
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

const validEvaluationRunRequest = {
  candidateDocumentId: '33333333-3333-4333-8333-333333333333',
  candidateId: '44444444-4444-4444-8444-444444444444',
  positionId: '55555555-5555-4555-8555-555555555555',
  requirements: validRequest.requirements,
  resumeText: validRequest.resumeText,
  evaluation: {
    candidateName: 'Candidato de prueba',
    earnedPoints: 10,
    totalPoints: 10,
    verdict: 'Apto',
    strengths: ['Experiencia con React'],
    gaps: [],
  },
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
    reusedExistingEvaluation: false,
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
    reusedExisting: false,
  })
  assert.deepEqual(candidateWrites.at(-1), {
    p_recruiter_id: 'authenticated-recruiter',
    p_full_name: 'Candidato de prueba',
    p_original_file_name: 'candidato.pdf',
    p_mime_type: 'application/pdf',
    p_size_bytes: 1024,
    p_storage_path: validCandidateRequest.storagePath,
    p_extracted_text: 'Experiencia con React',
    p_content_fingerprint: expectedFingerprint('Experiencia con React'),
  })
})

test('finds a matching candidate document without creating another record', async () => {
  const previousCandidateWriteCount = candidateWrites.length
  const response = await fetch(`${apiUrl}/api/candidates/lookup`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer candidate-lookup-test-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ extractedText: 'Existing candidate resume' }),
  })

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    found: true,
    candidateId: '66666666-6666-4666-8666-666666666666',
    candidateDocumentId: '88888888-8888-4888-8888-888888888888',
  })
  assert.deepEqual(candidateLookups.at(-1), {
    p_recruiter_id: 'authenticated-recruiter',
    p_content_fingerprint: expectedFingerprint('Existing candidate resume'),
    p_extracted_text: 'Existing candidate resume',
  })
  assert.equal(candidateWrites.length, previousCandidateWriteCount)
})

test('requires authentication before looking up duplicate candidate documents', async () => {
  const response = await fetch(`${apiUrl}/api/candidates/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ extractedText: 'Existing candidate resume' }),
  })

  assert.equal(response.status, 401)
})

test('requires authentication before saving an evaluation run', async () => {
  const response = await fetch(`${apiUrl}/api/evaluation-runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validEvaluationRunRequest),
  })

  assert.equal(response.status, 401)
  assert.equal(evaluationWrites.length, 0)
})

test('rejects invalid evaluation history data before writing to Supabase', async () => {
  const response = await fetch(`${apiUrl}/api/evaluation-runs`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer evaluation-test-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...validEvaluationRunRequest,
      candidateId: 'not-a-uuid',
    }),
  })

  assert.equal(response.status, 400)
  assert.equal(evaluationWrites.length, 0)
})

test('stores an evaluation run under the authenticated recruiter', async () => {
  const response = await fetch(`${apiUrl}/api/evaluation-runs`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer evaluation-test-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(validEvaluationRunRequest),
  })

  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), {
    applicationId: '11111111-1111-4111-8111-111111111111',
    evaluationRunId: '22222222-2222-4222-8222-222222222222',
    reusedExisting: false,
  })
  const { p_request_fingerprint, ...savedEvaluation } =
    evaluationWrites.at(-1)
  assert.deepEqual(savedEvaluation, {
    p_recruiter_id: 'authenticated-recruiter',
    p_candidate_id: validEvaluationRunRequest.candidateId,
    p_candidate_document_id: validEvaluationRunRequest.candidateDocumentId,
    p_position_id: validEvaluationRunRequest.positionId,
    p_earned_points: 10,
    p_total_points: 10,
    p_verdict: 'Apto',
    p_strengths: ['Experiencia con React'],
    p_gaps: [],
    p_evaluator_version: 'candidate-evaluation-v1',
  })
  assert.match(p_request_fingerprint, /^[0-9a-f]{64}$/)
})

test('reuses a matching evaluation without calling Azure OpenAI', async () => {
  const azureCallsBeforeLookup = azureCalls
  const response = await fetch(`${apiUrl}/api/evaluate-candidate`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer evaluation-test-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...validRequest,
      resumeText: 'Existing candidate resume',
    }),
  })

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    candidateName: 'Existing candidate',
    earnedPoints: 10,
    totalPoints: 10,
    verdict: 'Apto',
    strengths: ['Existing result'],
    gaps: [],
    reusedExistingEvaluation: true,
  })
  assert.equal(azureCalls, azureCallsBeforeLookup)
  const evaluationLookup = evaluationLookups.at(-1)
  assert.deepEqual(
    {
      p_recruiter_id: evaluationLookup.p_recruiter_id,
      p_candidate_id: evaluationLookup.p_candidate_id,
      p_position_id: evaluationLookup.p_position_id,
      p_evaluator_version: evaluationLookup.p_evaluator_version,
      p_requirements: evaluationLookup.p_requirements,
      p_resume_text: evaluationLookup.p_resume_text,
    },
    {
      p_recruiter_id: 'authenticated-recruiter',
      p_candidate_id: '66666666-6666-4666-8666-666666666666',
      p_position_id: validRequest.positionId,
      p_evaluator_version: 'candidate-evaluation-v1',
      p_requirements: validRequest.requirements,
      p_resume_text: 'Existing candidate resume',
    },
  )
  assert.match(evaluationLookup.p_request_fingerprint, /^[0-9a-f]{64}$/)
})

test('checks legacy evaluations before calling Azure OpenAI', async () => {
  const azureCallsBeforeLookup = azureCalls
  const response = await fetch(`${apiUrl}/api/evaluate-candidate`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer evaluation-test-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...validRequest,
      resumeText: 'Legacy candidate resume',
    }),
  })

  assert.equal(response.status, 200)
  assert.equal((await response.json()).reusedExistingEvaluation, true)
  assert.equal(azureCalls, azureCallsBeforeLookup)
  assert.equal(
    evaluationLookups.at(-1).p_resume_text,
    'Legacy candidate resume',
  )
})

test('does not reuse an evaluation when a job requirement changes', async () => {
  const azureCallsBeforeLookup = azureCalls
  const response = await fetch(`${apiUrl}/api/evaluate-candidate`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer evaluation-test-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...validRequest,
      requirements: {
        ...validRequest.requirements,
        skills: [{ name: 'React', points: 6 }],
      },
      resumeText: 'Existing candidate resume',
    }),
  })

  assert.equal(response.status, 200)
  assert.equal((await response.json()).reusedExistingEvaluation, false)
  assert.equal(azureCalls, azureCallsBeforeLookup + 1)
  assert.notEqual(
    evaluationLookups.at(-1).p_request_fingerprint,
    getEvaluationFingerprint(
      validRequest.requirements,
      'Existing candidate resume',
    ),
  )
})
