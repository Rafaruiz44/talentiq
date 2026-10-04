import { expect, mockAuthenticatedSession, test } from './fixtures'

const position = {
  id: 'position-1',
  title: 'Desarrollador Frontend',
  seniority: 'Semi Senior',
  seniority_points: 5,
  status: 'Abierta',
  position_skills: [{ name: 'React', points: 5 }],
}

const createResumePdf = (text: string): Buffer => {
  const content = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}\nendstream\nendobj\n`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(pdf, 'ascii'))
    pdf += object
  })
  const crossReferenceOffset = Buffer.byteLength(pdf, 'ascii')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${crossReferenceOffset}\n%%EOF`
  return Buffer.from(pdf, 'ascii')
}

test.beforeEach(async ({ page }) => {
  await mockAuthenticatedSession(page, [position])
})

test('analiza y guarda varios CVs de forma individual en una postulación', async ({
  page,
}) => {
  let lookupCalls = 0
  let candidateSaveCalls = 0
  let evaluationCalls = 0
  let evaluationRunCalls = 0

  await page.route('**/rest/v1/candidates?*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route('**/api/candidates/lookup', async (route) => {
    lookupCalls += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ found: false }),
    })
  })
  await page.route('**/storage/v1/object/candidate-cvs/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Key: 'candidate-cvs/test/resume.pdf' }),
    }),
  )
  await page.route('**/api/candidates', async (route) => {
    candidateSaveCalls += 1
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        candidateId: `candidate-${candidateSaveCalls}`,
        candidateDocumentId: `document-${candidateSaveCalls}`,
        reusedExisting: false,
      }),
    })
  })
  await page.route('**/api/evaluate-candidate', async (route) => {
    evaluationCalls += 1
    const isFirst = evaluationCalls === 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidateName: isFirst ? 'Candidata Apta' : 'Candidato No Apto',
        earnedPoints: isFirst ? 10 : 5,
        totalPoints: 10,
        verdict: isFirst ? 'Apto' : 'No Apto',
        strengths: ['Experiencia con React en proyectos'],
        gaps: [],
        reusedExistingEvaluation: false,
      }),
    })
  })
  await page.route('**/api/evaluation-runs', async (route) => {
    evaluationRunCalls += 1
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        applicationId: `application-${evaluationRunCalls}`,
        evaluationRunId: `run-${evaluationRunCalls}`,
        reusedExisting: false,
      }),
    })
  })

  await page.goto('/postulaciones')
  await expect(
    page.getByRole('heading', { name: 'Currículum' }),
  ).toBeVisible()
  await expect(page.getByTestId('application-cv-dropzone')).toContainText(
    'Arrastrá los CV acá o hacé clic para elegirlos',
  )
  await expect(page.getByTestId('application-cv-dropzone')).toContainText(
    'PDF · máx. 5 MB por archivo',
  )
  await expect(page.getByTestId('application-cv-files')).toHaveAttribute(
    'multiple',
    '',
  )
  await page.getByTestId('application-position').selectOption('position-1')
  await page.getByTestId('application-cv-files').setInputFiles([
    {
      name: 'apta.pdf',
      mimeType: 'application/pdf',
      buffer: createResumePdf('Desarrolladora Frontend React'),
    },
    {
      name: 'no-apto.pdf',
      mimeType: 'application/pdf',
      buffer: createResumePdf('Analista sin experiencia de desarrollo'),
    },
    {
      name: 'ignorado.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('no es PDF'),
    },
  ])

  await expect(page.getByTestId('application-progress')).toContainText(
    'Procesamiento terminado: 2 de 3 CVs guardados.',
  )
  await expect(page.getByTestId('application-file-0')).toContainText(
    'Apto · 100% de compatibilidad',
  )
  await expect(page.getByTestId('application-file-1')).toContainText(
    'No Apto · 50% de compatibilidad',
  )
  await expect(page.getByTestId('application-file-2')).toContainText(
    'El archivo debe ser un PDF válido.',
  )
  expect(lookupCalls).toBe(2)
  expect(candidateSaveCalls).toBe(2)
  expect(evaluationCalls).toBe(2)
  expect(evaluationRunCalls).toBe(2)
})

test('ordena el ranking por compatibilidad y muestra solo el resultado más reciente', async ({
  page,
}) => {
  let rankingUrl = ''
  await page.route('**/rest/v1/evaluation_runs?*', async (route) => {
    rankingUrl = route.request().url()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          application_id: 'application-top',
          candidate_id: 'candidate-top',
          candidate_document_id: 'document-top',
          earned_points: 9,
          total_points: 10,
          verdict: 'Apto',
          strengths: ['React en producción'],
          gaps: [],
          evaluated_at: '2026-10-04T18:00:00.000Z',
          applications: {
            position_id: 'position-1',
            candidates: { full_name: 'Mejor perfil' },
          },
          candidate_documents: { original_file_name: 'mejor.pdf' },
        },
        {
          application_id: 'application-second',
          candidate_id: 'candidate-second',
          candidate_document_id: 'document-second',
          earned_points: 8,
          total_points: 10,
          verdict: 'Apto',
          strengths: ['React en proyectos'],
          gaps: [],
          evaluated_at: '2026-10-04T17:00:00.000Z',
          applications: {
            position_id: 'position-1',
            candidates: { full_name: 'Perfil intermedio' },
          },
          candidate_documents: { original_file_name: 'intermedio.pdf' },
        },
        {
          application_id: 'application-third',
          candidate_id: 'candidate-third',
          candidate_document_id: 'document-third',
          earned_points: 6,
          total_points: 10,
          verdict: 'No Apto',
          strengths: [],
          gaps: ['Seniority no acreditado'],
          evaluated_at: '2026-10-04T16:00:00.000Z',
          applications: {
            position_id: 'position-1',
            candidates: { full_name: 'Perfil no apto' },
          },
          candidate_documents: { original_file_name: 'no-apto.pdf' },
        },
        {
          application_id: 'application-top',
          candidate_id: 'candidate-top',
          candidate_document_id: 'document-top',
          earned_points: 5,
          total_points: 10,
          verdict: 'No Apto',
          strengths: [],
          gaps: [],
          evaluated_at: '2026-10-03T16:00:00.000Z',
          applications: {
            position_id: 'position-1',
            candidates: { full_name: 'Mejor perfil' },
          },
          candidate_documents: { original_file_name: 'mejor.pdf' },
        },
      ]),
    })
  })

  await page.goto('/ranking')
  await page.getByTestId('ranking-position').selectOption('position-1')
  await expect(page.getByTestId('ranking-item')).toHaveCount(3)
  const names = await page.locator('[data-testid="ranking-item"] h3').allTextContents()
  expect(names).toEqual(['Mejor perfil', 'Perfil intermedio', 'Perfil no apto'])
  await expect(page.getByTestId('ranking-list')).toContainText('90%')
  await expect(page.getByTestId('ranking-list')).toContainText('Apto')
  const evaluationDetails = page
    .getByTestId('ranking-item')
    .first()
    .locator('details')
  await expect(evaluationDetails).not.toHaveAttribute('open', '')
  await evaluationDetails.locator('summary').click()
  await expect(evaluationDetails).toContainText('React en producción')
  await expect(evaluationDetails).toContainText(
    'No se registraron brechas.',
  )
  expect(new URL(rankingUrl).searchParams.get('recruiter_id')).toBe(
    'eq.11111111-1111-4111-8111-111111111111',
  )
  expect(new URL(rankingUrl).searchParams.get('applications.position_id')).toBe(
    'eq.position-1',
  )
})
