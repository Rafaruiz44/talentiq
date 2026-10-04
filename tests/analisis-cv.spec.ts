import {
  expect,
  mockAuthenticatedSession,
  test,
  type Page,
} from './fixtures'

const resumeText =
  'Desarrollador Frontend con experiencia en React, TypeScript y Semi Senior'

const createResumePdf = (): Buffer => {
  const content = `BT /F1 12 Tf 72 720 Td (${resumeText}) Tj ET`
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

const prepareAnalysis = async (
  page: Page,
  failEvaluationSave = false,
  findExistingCandidate = false,
) => {
  const capturedRequest = { authorization: '', body: '' }
  const evaluation = {
    candidateName: 'Candidato de prueba',
    earnedPoints: 15,
    totalPoints: 15,
    verdict: 'Apto',
    strengths: [
      'Experiencia con React: evidencia de proyectos',
      'Experiencia con TypeScript: evidencia de proyectos',
      'Perfil alineado al rol Desarrollador Frontend',
      'Seniority coincidente',
    ],
    gaps: [],
  }
  const candidateSaveRequest = { authorization: '', body: '', calls: 0 }
  const evaluationRunRequest = { authorization: '', body: '', calls: 0 }
  const candidateLookupRequest = { body: '', calls: 0 }
  let storageUploadCalls = 0
  let evaluationCalls = 0

  await page.route('**/api/evaluate-candidate', async (route) => {
    evaluationCalls += 1
    capturedRequest.authorization =
      route.request().headers().authorization ?? ''
    capturedRequest.body = route.request().postData() ?? ''
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...evaluation,
        reusedExistingEvaluation: evaluationCalls > 1,
      }),
    })
  })
  await page.route('**/storage/v1/object/candidate-cvs/**', (route) => {
    storageUploadCalls += 1
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Key: 'candidate-cvs/test/resume.pdf' }),
    })
  })
  await page.route('**/api/candidates/lookup', async (route) => {
    candidateLookupRequest.calls += 1
    candidateLookupRequest.body = route.request().postData() ?? ''
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        findExistingCandidate
          ? {
              found: true,
              candidateId: 'candidate-1',
              candidateDocumentId: 'document-1',
            }
          : { found: false },
      ),
    })
  })
  await page.route('**/api/candidates', async (route) => {
    candidateSaveRequest.calls += 1
    candidateSaveRequest.authorization =
      route.request().headers().authorization ?? ''
    candidateSaveRequest.body = route.request().postData() ?? ''
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        candidateId: 'candidate-1',
        candidateDocumentId: 'document-1',
        reusedExisting: false,
      }),
    })
  })
  await page.route('**/api/evaluation-runs', async (route) => {
    evaluationRunRequest.calls += 1
    evaluationRunRequest.authorization =
      route.request().headers().authorization ?? ''
    evaluationRunRequest.body = route.request().postData() ?? ''
    await route.fulfill({
      status: failEvaluationSave ? 502 : 201,
      contentType: 'application/json',
      body: JSON.stringify(
        failEvaluationSave
          ? { error: 'No se pudo guardar el resultado del análisis en Supabase.' }
          : {
              applicationId: 'application-1',
              evaluationRunId: 'evaluation-run-1',
              reusedExisting: false,
            },
      ),
    })
  })

  await page.goto('/puestos/position-1')

  const fileChooserPromise = page.waitForEvent('filechooser')
  await page
    .getByRole('button', {
      name: 'Arrastrá el CV acá o hacé clic para elegirlo PDF · máx. 5 MB',
    })
    .click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles({
    name: 'candidato.pdf',
    mimeType: 'application/pdf',
    buffer: createResumePdf(),
  })

  return {
    candidateSaveRequest,
    candidateLookupRequest,
    evaluationRequest: capturedRequest,
    evaluationRunRequest,
    get storageUploadCalls() {
      return storageUploadCalls
    },
  }
}

test.beforeEach(async ({ page }) => {
  await mockAuthenticatedSession(page, [
    {
      id: 'position-1',
      title: 'Desarrollador Frontend',
      seniority: 'Semi Senior',
      seniority_points: 5,
      status: 'Nueva',
      position_skills: [
        { name: 'React', points: 5 },
        { name: 'TypeScript', points: 5 },
      ],
    },
  ])
})

test('muestra el currículum a todo el ancho y el análisis debajo', async ({
  page,
}) => {
  await page.goto('/puestos/position-1')

  const workspace = page.getByTestId('analysis-workspace')
  const cvPanel = page.getByTestId('cv-upload-panel')
  const analysisColumn = page.getByTestId('analysis-controls-column')
  const workspaceBox = await workspace.boundingBox()
  const cvBox = await cvPanel.boundingBox()
  const analysisBox = await analysisColumn.boundingBox()

  expect(workspaceBox).not.toBeNull()
  expect(cvBox).not.toBeNull()
  expect(analysisBox).not.toBeNull()
  expect(cvBox!.width).toBeGreaterThan(workspaceBox!.width * 0.9)
  expect(analysisBox!.y).toBeGreaterThanOrEqual(cvBox!.y + cvBox!.height)
})

test('calcula y muestra la compatibilidad y el veredicto', async ({ page }) => {
  const { candidateSaveRequest, evaluationRequest, evaluationRunRequest } =
    await prepareAnalysis(page)

  await page.getByRole('button', { name: 'Procesar análisis' }).click()

  expect(evaluationRequest.authorization).toMatch(/^Bearer .+/)
  expect(JSON.parse(evaluationRequest.body)).toMatchObject({
    requirements: { role: 'Desarrollador Frontend' },
    resumeText: expect.stringContaining('React'),
    positionId: 'position-1',
  })
  const results = page.getByRole('region', { name: 'Resultados del análisis' })
  await expect(results).toBeVisible()
  await expect(results).toContainText('100%')
  await expect(results).toContainText('Apto')
  await expect(page.getByTestId('candidate-save-notice')).toContainText(
    'resultado del análisis se guardó en el historial',
  )
  expect(candidateSaveRequest.authorization).toMatch(/^Bearer .+/)
  expect(JSON.parse(candidateSaveRequest.body)).toMatchObject({
    candidateName: 'Candidato de prueba',
    fileName: 'candidato.pdf',
    mimeType: 'application/pdf',
    extractedText: expect.stringContaining('React'),
  })
  expect(candidateSaveRequest.calls).toBe(1)
  expect(evaluationRunRequest.authorization).toMatch(/^Bearer /)
  expect(JSON.parse(evaluationRunRequest.body)).toMatchObject({
    candidateId: 'candidate-1',
    candidateDocumentId: 'document-1',
    positionId: 'position-1',
    evaluation: {
      earnedPoints: 15,
      totalPoints: 15,
      verdict: 'Apto',
      strengths: expect.arrayContaining([
        expect.stringContaining('React'),
      ]),
      gaps: [],
    },
  })
  expect(evaluationRunRequest.calls).toBe(1)

  await page.getByRole('button', { name: 'Procesar análisis' }).click()
  await expect(results).toBeVisible()
  expect(candidateSaveRequest.calls).toBe(1)
  expect(evaluationRunRequest.calls).toBe(1)
  await expect(page.getByTestId('candidate-save-notice')).toContainText(
    'se reutilizó la evaluación existente',
  )
})

test('informa si el resultado no se pudo guardar en el historial', async ({
  page,
}) => {
  await prepareAnalysis(page, true)

  await page.getByRole('button', { name: 'Procesar análisis' }).click()

  await expect(
    page.getByRole('region', { name: 'Resultados del análisis' }),
  ).toBeVisible()
  await expect(page.getByTestId('candidate-save-error')).toContainText(
    'El análisis se completó, pero no se pudo guardar en el historial',
  )
})

test('reutiliza un CV existente sin subir otra copia al bucket', async ({
  page,
}) => {
  const {
    candidateLookupRequest,
    candidateSaveRequest,
    evaluationRunRequest,
    storageUploadCalls,
  } = await prepareAnalysis(page, false, true)

  await page.getByRole('button', { name: 'Procesar análisis' }).click()

  await expect(
    page.getByTestId('candidate-save-notice'),
  ).toContainText('El CV ya estaba en el banco; se reutilizó')
  await expect(
    page.getByTestId('candidate-save-notice'),
  ).toContainText('nueva evaluación')
  expect(candidateLookupRequest.calls).toBe(1)
  expect(JSON.parse(candidateLookupRequest.body)).toMatchObject({
    extractedText: expect.stringContaining('React'),
  })
  expect(storageUploadCalls).toBe(0)
  expect(candidateSaveRequest.calls).toBe(0)
  expect(evaluationRunRequest.calls).toBe(1)
})

test('muestra el desglose de fortalezas y brechas', async ({ page }) => {
  await prepareAnalysis(page)

  await page.getByRole('button', { name: 'Procesar análisis' }).click()

  const results = page.getByRole('region', { name: 'Resultados del análisis' })
  await expect(results.getByRole('heading', { name: 'Fortalezas' })).toBeVisible()
  const lists = results.getByRole('list')
  await expect(lists).toHaveCount(2)
  const strengths = lists.first().getByRole('listitem')
  await expect(strengths).toHaveCount(4)
  await expect(strengths.nth(0)).toContainText('React')
  await expect(strengths.nth(1)).toContainText('TypeScript')
  await expect(strengths.nth(2)).toContainText('Perfil alineado al rol')
  await expect(strengths.nth(3)).toContainText('Seniority coincidente')
  await expect(
    results.getByRole('heading', { name: 'Brechas o habilidades faltantes' }),
  ).toBeVisible()
  await expect(lists.nth(1)).toBeEmpty()
})

test('permite cambiar entre modo claro y oscuro y conservar la elección en la sesión', async ({ page }) => {
  await page.goto('/')

  const app = page.getByRole('main')
  await expect(app).toHaveAttribute('data-theme', 'light')

  await page.getByRole('button', { name: 'Cambiar a modo oscuro' }).click()
  await expect(app).toHaveAttribute('data-theme', 'dark')

  await page.reload()
  await expect(app).toHaveAttribute('data-theme', 'dark')
})
