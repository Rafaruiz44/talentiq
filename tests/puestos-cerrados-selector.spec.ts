import { expect, mockAuthenticatedSession, test } from './fixtures'

const createPosition = (id: string, title: string, status: 'Abierta' | 'Cerrada') => ({
  id,
  title,
  seniority: 'Junior',
  seniority_points: 5,
  acceptance_threshold: 70,
  status,
  position_skills: [{ name: 'Excel', points: 5 }],
})

const positions = [
  createPosition('position-open', 'Analista Contable', 'Abierta'),
  createPosition('position-closed', 'Encargado de Depósito', 'Cerrada'),
]

test.beforeEach(async ({ page }) => {
  await mockAuthenticatedSession(page, positions)
  await page.route('**/rest/v1/evaluation_runs?*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
})

test('Postulaciones oculta los puestos cerrados salvo que se incluyan', async ({
  page,
}) => {
  await page.goto('/postulaciones')
  const select = page.getByTestId('application-position')

  await expect(select.locator('option[value="position-open"]')).toHaveCount(1)
  await expect(select.locator('option[value="position-closed"]')).toHaveCount(0)

  await page.getByTestId('application-include-closed').check()
  await expect(select.locator('option[value="position-closed"]')).toHaveCount(1)
})

test('Ranking oculta los puestos cerrados salvo que se incluyan', async ({
  page,
}) => {
  await page.goto('/ranking')
  const select = page.getByTestId('ranking-position')

  await expect(select.locator('option[value="position-closed"]')).toHaveCount(0)

  await page.getByTestId('ranking-include-closed').check()
  await select.selectOption('position-closed')
  await expect(select.locator('option[value="position-closed"]')).toContainText('(cerrada)')

  // The selected closed position stays available after hiding closed ones.
  await page.getByTestId('ranking-include-closed').uncheck()
  await expect(select).toHaveValue('position-closed')
})
