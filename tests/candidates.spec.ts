import { expect, mockAuthenticatedSession, test } from './fixtures'

const recruiterId = '11111111-1111-4111-8111-111111111111'
const candidateId = '22222222-2222-4222-8222-222222222222'
const candidateDocumentId = '33333333-3333-4333-8333-333333333333'
const resumeText = 'Desarrolladora Frontend con React y TypeScript'

test('lista candidatos propios y reevalúa un CV guardado en otra posición sin subirlo otra vez', async ({
  page,
}) => {
  await mockAuthenticatedSession(page, [
    {
      id: 'position-1',
      title: 'Desarrollador Frontend',
      seniority: 'Semi Senior',
      seniority_points: 5,
      status: 'Abierta',
      position_skills: [
        { name: 'React', points: 5 },
        { name: 'TypeScript', points: 5 },
      ],
    },
  ])

  let candidateListUrl = ''
  let selectedDocumentUrl = ''
  let evaluationRequestBody = ''
  let evaluationRunRequestBody = ''
  let candidateUploadCalls = 0

  await page.route('**/rest/v1/candidates?*', async (route) => {
    candidateListUrl = route.request().url()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: candidateId,
          full_name: 'María Candidata',
          created_at: '2026-10-01T12:00:00.000Z',
          candidate_documents: [
            {
              id: candidateDocumentId,
              original_file_name: 'maria-cv.pdf',
              processing_status: 'processed',
              created_at: '2026-10-02T12:00:00.000Z',
            },
          ],
        },
      ]),
    })
  })
  await page.route('**/rest/v1/candidate_documents?*', async (route) => {
    selectedDocumentUrl = route.request().url()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidate_id: candidateId,
        id: candidateDocumentId,
        original_file_name: 'maria-cv.pdf',
        extracted_text: resumeText,
        processing_status: 'processed',
      }),
    })
  })
  await page.route('**/api/evaluate-candidate', async (route) => {
    evaluationRequestBody = route.request().postData() ?? ''
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidateName: 'María Candidata',
        earnedPoints: 10,
        totalPoints: 10,
        verdict: 'Apto',
        strengths: [
          'Experiencia profesional con React en desarrollo frontend',
          'Uso de TypeScript en proyectos frontend',
          'Experiencia en desarrollo de interfaces web',
          'Conocimientos alineados con desarrollo frontend',
        ],
        gaps: [],
        reusedExistingEvaluation: false,
      }),
    })
  })
  await page.route('**/api/evaluation-runs', async (route) => {
    evaluationRunRequestBody = route.request().postData() ?? ''
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        applicationId: '44444444-4444-4444-8444-444444444444',
        evaluationRunId: '55555555-5555-4555-8555-555555555555',
        reusedExisting: false,
      }),
    })
  })
  await page.route('**/api/candidates', async (route) => {
    candidateUploadCalls += 1
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })

  await page.goto('/candidatos')
  await expect(page.getByRole('heading', { name: 'María Candidata' })).toBeVisible()
  await expect(page.getByText('maria-cv.pdf')).toBeVisible()
  expect(new URL(candidateListUrl).searchParams.get('recruiter_id')).toBe(
    `eq.${recruiterId}`,
  )

  await page.getByTestId('candidate-position').selectOption('position-1')
  await page
    .getByRole('button', { name: 'Analizar en esta posición' })
    .click()

  await expect(page.getByTestId('candidate-bank-notice')).toContainText(
    'Apto, 100% de compatibilidad para Desarrollador Frontend',
  )
  expect(new URL(selectedDocumentUrl).searchParams.get('recruiter_id')).toBe(
    `eq.${recruiterId}`,
  )
  expect(JSON.parse(evaluationRequestBody)).toMatchObject({
    positionId: 'position-1',
    resumeText,
  })
  expect(JSON.parse(evaluationRunRequestBody)).toMatchObject({
    candidateId,
    candidateDocumentId,
    positionId: 'position-1',
    resumeText,
  })
  expect(candidateUploadCalls).toBe(0)
})
