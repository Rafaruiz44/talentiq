import { expect, mockAuthenticatedSession, test } from './fixtures'

const positions = [
  {
    id: 'position-1',
    title: 'Desarrollador Backend',
    seniority: 'Semi Senior',
    seniority_points: 7,
    status: 'Abierta',
    position_skills: [{ name: 'SQL', points: 9 }],
  },
  {
    id: 'position-2',
    title: 'Diseñador UX',
    seniority: 'Senior',
    seniority_points: 6,
    status: 'Nueva',
    position_skills: [{ name: 'Figma', points: 8 }],
  },
]

test('sin puestos abre Evaluación de CV con el aviso para crear un puesto', async ({
  page,
}) => {
  await mockAuthenticatedSession(page)
  await page.goto('/puestos')

  const menuLink = page.getByRole('link', { name: 'Evaluación de CV' })
  await menuLink.click()

  await expect(page).toHaveURL(/\/evaluacion-cv$/)
  await expect(page.getByTestId('cv-evaluation-no-positions')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Primero crea un puesto' }),
  ).toBeVisible()
  await expect(menuLink).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('link', { name: 'Puestos' })).not.toHaveAttribute(
    'aria-current',
    'page',
  )

  await page.getByTestId('cv-evaluation-create-position').click()
  await expect(page).toHaveURL(/\/puestos\/nuevo$/)
})

test('un error al cargar los puestos no se presenta como cuenta sin puestos', async ({
  page,
}) => {
  await mockAuthenticatedSession(page)
  await page.route('**/rest/v1/positions?*', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Database unavailable' }),
    }),
  )
  await page.goto('/evaluacion-cv')

  await expect(page.getByTestId('cv-evaluation-error')).toBeVisible()
  await expect(page.getByTestId('cv-evaluation-no-positions')).toHaveCount(0)
})

test('mientras cargan los puestos no se muestra el aviso de cuenta sin puestos', async ({
  page,
}) => {
  await mockAuthenticatedSession(page)
  let releaseResponse: () => void = () => undefined
  const responseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve
  })
  await page.route('**/rest/v1/positions?*', async (route) => {
    await responseGate
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })
  await page.goto('/evaluacion-cv')

  await expect(page.getByTestId('cv-evaluation-loading')).toBeVisible()
  await expect(page.getByTestId('cv-evaluation-no-positions')).toHaveCount(0)

  releaseResponse()
  await expect(page.getByTestId('cv-evaluation-no-positions')).toBeVisible()
})

test('con puestos muestra la lista para elegir y no abre ninguno solo', async ({
  page,
}) => {
  await mockAuthenticatedSession(page, positions)
  await page.goto('/puestos')

  await page.getByRole('link', { name: 'Evaluación de CV' }).click()

  await expect(page).toHaveURL(/\/evaluacion-cv$/)
  await expect(page.getByTestId('cv-evaluation-position-list')).toBeVisible()
  await expect(page.getByTestId('cv-evaluation-select-position')).toHaveCount(2)
  await expect(page.getByTestId('position-detail')).toHaveCount(0)
  await expect(page.getByTestId('cv-evaluation-no-positions')).toHaveCount(0)
})

test('elegir un puesto de la lista abre su carga y evaluación de CV', async ({
  page,
}) => {
  await mockAuthenticatedSession(page, positions)
  await page.goto('/evaluacion-cv')

  await page
    .getByRole('button', { name: 'Evaluar CVs para Desarrollador Backend' })
    .click()

  await expect(page).toHaveURL(/\/puestos\/position-1#cv-analysis$/)
  await expect(page.getByTestId('position-detail')).toBeVisible()
  await expect(page.getByTestId('analysis-workspace')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Desarrollador Backend', level: 2 }),
  ).toBeVisible()
})

test('el último puesto creado no se abre solo al volver a Evaluación de CV', async ({
  page,
}) => {
  await mockAuthenticatedSession(page, positions)
  await page.route('**/rest/v1/rpc/save_position', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify('position-created'),
    }),
  )
  await page.goto('/puestos/nuevo')

  await page.getByRole('textbox', { name: 'Nombre del puesto' }).fill('Backend')
  await page.getByRole('textbox', { name: 'Habilidad' }).fill('PostgreSQL')
  await page.getByTestId('skill-points').fill('8')
  await page.getByTestId('add-skill').click()
  await page.getByTestId('job-seniority').selectOption('Senior')
  await page.getByTestId('job-seniority-points').fill('6')
  await page.getByRole('button', { name: 'Crear puesto' }).click()
  await expect(page.getByTestId('position-detail')).toBeVisible()

  await page.getByRole('link', { name: 'Evaluación de CV' }).click()

  await expect(page).toHaveURL(/\/evaluacion-cv$/)
  await expect(page.getByTestId('cv-evaluation-position-list')).toBeVisible()
  await expect(page.getByTestId('position-detail')).toHaveCount(0)
})
