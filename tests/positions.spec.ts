import { expect, mockAuthenticatedSession, test } from './fixtures'

test('carga un puesto guardado con las ponderaciones de sus habilidades', async ({
  page,
}) => {
  await mockAuthenticatedSession(page, [
    {
      id: 'position-1',
      title: 'Desarrollador Backend',
      seniority: 'Semi Senior',
      seniority_points: 7,
      status: 'Abierta',
      position_skills: [{ name: 'SQL', points: 9 }],
    },
  ])
  await page.goto('/')

  await page.getByTestId('saved-positions').selectOption('position-1')

  await expect(
    page.getByRole('textbox', { name: 'Nombre del puesto' }),
  ).toHaveValue('Desarrollador Backend')
  await expect(page.getByTestId('skill-weight-0')).toHaveValue('9')
  await expect(page.getByTestId('job-seniority')).toHaveValue('Semi Senior')
  await expect(page.getByTestId('job-seniority-points')).toHaveValue('7')

  await page.getByTestId('new-position').click()
  await expect(
    page.getByRole('textbox', { name: 'Nombre del puesto' }),
  ).toHaveValue('')
})

test('actualiza las habilidades del puesto seleccionado', async ({ page }) => {
  await mockAuthenticatedSession(page, [
    {
      id: 'position-1',
      title: 'Desarrollador Backend',
      seniority: 'Semi Senior',
      seniority_points: 7,
      status: 'Abierta',
      position_skills: [{ name: 'SQL', points: 5 }],
    },
  ])
  let rpcRequestBody = ''
  await page.route('**/rest/v1/rpc/save_position', async (route) => {
    rpcRequestBody = route.request().postData() ?? ''
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify('position-1'),
    })
  })
  await page.goto('/')

  await page.getByTestId('saved-positions').selectOption('position-1')
  await page.getByTestId('skill-weight-0').fill('9')
  await page.getByTestId('save-position').click()

  await expect(page.getByTestId('position-notice')).toHaveText(
    'Puesto actualizado.',
  )
  expect(JSON.parse(rpcRequestBody)).toMatchObject({
    p_position_id: 'position-1',
    p_skills: [{ name: 'SQL', points: 9 }],
  })
})

test('guarda el puesto y sus habilidades mediante la operación autenticada', async ({
  page,
}) => {
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
  await page.goto('/')

  await page.getByRole('textbox', { name: 'Nombre del puesto' }).fill('Backend')
  await page.getByRole('textbox', { name: 'Habilidad' }).fill('PostgreSQL')
  await page.getByTestId('skill-points').fill('8')
  await page.getByTestId('add-skill').click()
  await page.getByTestId('job-seniority').selectOption('Senior')
  await page.getByTestId('job-seniority-points').fill('6')
  await page.getByTestId('save-position').click()

  await expect(page.getByTestId('position-notice')).toHaveText('Puesto guardado.')
  await expect(page.getByTestId('saved-positions')).toHaveValue(
    'position-created',
  )
  expect(JSON.parse(rpcRequestBody)).toEqual({
    p_position_id: null,
    p_title: 'Backend',
    p_seniority: 'Senior',
    p_seniority_points: 6,
    p_skills: [{ name: 'PostgreSQL', points: 8 }],
  })
})

test('muestra explícitamente los errores al guardar un puesto', async ({
  page,
}) => {
  await mockAuthenticatedSession(page)
  await page.route('**/rest/v1/rpc/save_position', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Permission denied' }),
    }),
  )
  await page.goto('/')

  await page.getByRole('textbox', { name: 'Nombre del puesto' }).fill('Backend')
  await page.getByRole('textbox', { name: 'Habilidad' }).fill('SQL')
  await page.getByTestId('add-skill').click()
  await page.getByTestId('job-seniority').selectOption('Junior')
  await page.getByTestId('save-position').click()

  await expect(page.getByTestId('position-error')).toContainText(
    'No se pudo guardar el puesto',
  )
})
