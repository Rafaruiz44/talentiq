import { expect, mockAuthenticatedSession, test } from './fixtures'

const createPosition = (status: 'Abierta' | 'Cerrada') => ({
  id: 'position-1',
  title: 'Desarrollador Frontend',
  seniority: 'Semi Senior',
  seniority_points: 5,
  acceptance_threshold: 70,
  status,
  position_skills: [{ name: 'React', points: 5 }],
})

const existingCandidate = {
  id: 'existing-candidate-1',
  full_name: 'Esteban Base',
  email: 'esteban@db.com',
  phone: '+54 9 11 5555-6666',
  created_at: '2026-10-01T10:00:00.000Z',
  candidate_documents: [
    {
      id: 'doc-existing-1',
      original_file_name: 'esteban-cv.pdf',
      processing_status: 'processed',
      created_at: '2026-10-02T10:00:00.000Z',
    },
  ],
}

const mockApplicationStatus = async (
  page: Parameters<typeof mockAuthenticatedSession>[0],
  initialStatus: 'Abierta' | 'Cerrada',
) => {
  let persistedStatus = initialStatus
  const persistedUpdates: string[] = []

  await mockAuthenticatedSession(page, [createPosition(initialStatus)])

  await page.route('**/rest/v1/positions?*', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as { status: 'Abierta' | 'Cerrada' }
      persistedStatus = body.status
      persistedUpdates.push(body.status)
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([createPosition(persistedStatus)]),
    })
  })

  await page.route('**/rest/v1/candidates?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([existingCandidate]),
    }),
  )

  return { persistedUpdates }
}

test('cerrar persiste el estado Cerrada, muestra el aviso y bloquea carga y evaluación', async ({
  page,
}) => {
  const { persistedUpdates } = await mockApplicationStatus(page, 'Abierta')

  // El botón de cerrar puesto está en el listado de puestos a la derecha de Ver puesto
  await page.goto('/puestos')
  await page.getByTestId('toggle-status-position-1').click()
  expect(persistedUpdates).toEqual(['Cerrada'])

  // Al ir a postulaciones para esa posición, debe mostrarse cerrada
  await page.goto('/postulaciones')
  await page
    .getByRole('combobox', { name: 'Postulación / posición' })
    .selectOption('position-1')

  await expect(
    page.getByRole('combobox', { name: 'Postulación / posición' }),
  ).toHaveValue('position-1')
  await expect(page.getByTestId('application-closed-message')).toContainText(
    'Abrir postulación para cargar CVs',
  )
  await page.getByRole('button', { name: 'Cargar masivamente CVs' }).click()
  await expect(page.getByTestId('application-cv-files')).toBeDisabled()

  await page.getByRole('button', { name: 'Usar candidatos de la base (1)' }).click()
  await page
    .getByRole('checkbox', { name: /Esteban Base/ })
    .check()
  await expect(
    page.getByRole('button', { name: 'Evaluar 1 candidato seleccionado' }),
  ).toBeDisabled()

  await page.goto('/puestos')
  await expect(page.getByTestId('toggle-status-position-1')).toContainText('Abrir puesto')
})

test('abrir persiste el estado Abierta y rehabilita los controles', async ({
  page,
}) => {
  const { persistedUpdates } = await mockApplicationStatus(page, 'Cerrada')

  // Abrir el puesto desde el listado de puestos
  await page.goto('/puestos')
  await page.getByTestId('toggle-status-position-1').click()
  expect(persistedUpdates).toEqual(['Abierta'])

  // Al ir a postulaciones para esa posición, debe estar habilitada
  await page.goto('/postulaciones')
  await page
    .getByRole('combobox', { name: 'Postulación / posición' })
    .selectOption('position-1')

  await expect(
    page.getByRole('combobox', { name: 'Postulación / posición' }),
  ).toHaveValue('position-1')
  await page.getByRole('button', { name: 'Cargar masivamente CVs' }).click()
  await expect(page.getByTestId('application-cv-files')).toBeEnabled()

  await page.getByRole('button', { name: 'Usar candidatos de la base (1)' }).click()
  await page
    .getByRole('checkbox', { name: /Esteban Base/ })
    .check()
  await expect(
    page.getByRole('button', { name: 'Evaluar 1 candidato seleccionado' }),
  ).toBeEnabled()

  await page.goto('/puestos')
  await expect(page.getByTestId('toggle-status-position-1')).toContainText('Cerrar puesto')
})

