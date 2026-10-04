import { expect, test, mockAuthenticatedSession } from './fixtures'

test.beforeEach(async ({ page }) => {
  await mockAuthenticatedSession(page, [
    {
      id: 'position-1',
      title: 'Desarrollador Backend',
      seniority: 'Semi Senior',
      seniority_points: 5,
      status: 'Nueva',
      position_skills: [{ name: 'SQL', points: 5 }],
    },
  ])
})

test('mantiene deshabilitada la creación hasta completar los datos requeridos', async ({ page }) => {
  await page.goto('/puestos/nuevo')

  const createButton = page.getByRole('button', { name: 'Crear puesto' })
  await expect(createButton).toBeDisabled()

  await page.getByRole('textbox', { name: 'Nombre del puesto' }).fill('Desarrollador Backend')
  await expect(createButton).toBeDisabled()

  await page.getByRole('textbox', { name: 'Habilidad' }).fill('SQL')
  await page.getByRole('button', { name: '+ Agregar' }).click()
  await expect(createButton).toBeDisabled()
  await page.getByRole('combobox', { name: 'Nivel' }).selectOption({ label: 'Semi Senior' })
  await expect(createButton).toBeEnabled()
})

test('agrega una habilidad con su peso individual', async ({ page }) => {
  await page.goto('/puestos/nuevo')

  await page.getByRole('textbox', { name: 'Nombre del puesto' }).fill('Desarrollador Backend')
  await page.getByRole('textbox', { name: 'Habilidad' }).fill('SQL')
  await page.getByTestId('skill-points').fill('8')
  await page.getByRole('button', { name: '+ Agregar' }).click()

  await expect(page.getByRole('textbox', { name: 'Habilidad' })).toHaveValue('')
  await expect(page.getByRole('listitem')).toContainText('SQL')
  await expect(page.getByRole('listitem')).toContainText('8')
})

test('permite modificar el peso de una habilidad ya agregada', async ({ page }) => {
  await page.goto('/puestos/nuevo')

  await page.getByRole('textbox', { name: 'Habilidad' }).fill('SQL')
  await page.getByRole('button', { name: '+ Agregar' }).click()
  await page.getByTestId('skill-weight-0').fill('9')

  await expect(page.getByTestId('skill-weight-0')).toHaveValue('9')
  await expect(page.getByTestId('skills-list').getByRole('listitem')).toContainText('9')
})
