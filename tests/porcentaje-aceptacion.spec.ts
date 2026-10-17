import { expect, mockAuthenticatedSession, test } from './fixtures'

const positionWithThreshold = (acceptanceThreshold: number) => ({
  id: 'position-1',
  title: 'Desarrollador Backend',
  seniority: 'Semi Senior',
  seniority_points: 5,
  acceptance_threshold: acceptanceThreshold,
  status: 'Abierta',
  position_skills: [{ name: 'SQL', points: 5 }],
})

test('muestra 70 como porcentaje mínimo de aceptación predeterminado', async ({
  page,
}) => {
  await mockAuthenticatedSession(page)
  await page.goto('/puestos/nuevo')

  const threshold = page.getByRole('slider', {
    name: 'Porcentaje mínimo de aceptación',
  })
  await expect(threshold).toHaveValue('70')
  await expect(page.getByRole('status').filter({ hasText: '70%' })).toBeVisible()
  await expect(threshold).toHaveAttribute('min', '50')
  await expect(threshold).toHaveAttribute('max', '100')
  await expect(threshold).toHaveAttribute('step', '5')
})

test('permite mover el porcentaje mínimo de aceptación a 85', async ({ page }) => {
  await mockAuthenticatedSession(page)
  await page.goto('/puestos/nuevo')

  const threshold = page.getByRole('slider', {
    name: 'Porcentaje mínimo de aceptación',
  })
  await threshold.focus()
  await threshold.press('ArrowRight')
  await threshold.press('ArrowRight')
  await threshold.press('ArrowRight')

  await expect(threshold).toHaveValue('85')
  await expect(page.getByRole('status').filter({ hasText: '85%' })).toBeVisible()
})

test('envía 85 como porcentaje mínimo de aceptación al guardar', async ({ page }) => {
  await mockAuthenticatedSession(page)
  let rpcRequestBody = ''
  await page.route('**/rest/v1/rpc/save_position', async (route) => {
    rpcRequestBody = route.request().postData() ?? ''
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify('position-created'),
    })
  })
  await page.goto('/puestos/nuevo')

  await page.getByRole('textbox', { name: 'Nombre del puesto' }).fill('Backend')
  await page.getByRole('textbox', { name: 'Habilidad' }).fill('SQL')
  await page.getByRole('button', { name: '+ Agregar' }).click()
  await page.getByRole('combobox', { name: 'Nivel' }).selectOption('Senior')
  await page
    .getByRole('slider', { name: 'Porcentaje mínimo de aceptación' })
    .fill('85')
  await page.getByRole('button', { name: 'Crear puesto' }).click()

  await expect(page.getByRole('heading', { name: 'Backend', level: 2 })).toBeVisible()
  expect(JSON.parse(rpcRequestBody)).toMatchObject({
    p_acceptance_threshold: 85,
  })
})

test('carga el porcentaje mínimo de aceptación persistido al editar', async ({
  page,
}) => {
  await mockAuthenticatedSession(page, [positionWithThreshold(85)])
  await page.goto('/puestos/position-1/editar')

  await expect(
    page.getByRole('slider', { name: 'Porcentaje mínimo de aceptación' }),
  ).toHaveValue('85')
  await expect(page.getByRole('status').filter({ hasText: '85%' })).toBeVisible()
})

test('muestra el porcentaje mínimo de aceptación en el detalle', async ({ page }) => {
  await mockAuthenticatedSession(page, [positionWithThreshold(85)])
  await page.goto('/puestos/position-1')

  await expect(page.getByText('Porcentaje mínimo de aceptación')).toBeVisible()
  await expect(page.getByText('85%', { exact: true })).toBeVisible()
})
