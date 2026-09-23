import { expect, test } from '@playwright/test'

test('valida los campos requeridos de la definición del puesto', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Guardar requerimientos' }).click()

  const alerts = page.getByRole('alert')

  await expect(alerts).toHaveCount(3)
  await expect(alerts).toContainText([
    'Ingresá el rol del puesto.',
    'Agregá al menos una habilidad.',
    'Ingresá los años o el seniority requerido.',
  ])
})

test('separa habilidades y permite valorar cada una de forma independiente', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByLabel('Habilidades solicitadas').fill('SQL, Java; Python, React')
  await page.getByTestId('add-skill').click()
  await page.getByLabel('ROL / Puesto').fill('Desarrollador')
  await page.getByLabel('Años / seniority').fill('Senior')
  await page.getByRole('button', { name: 'Guardar requerimientos' }).click()

  await expect(page.getByTestId('job-requirements-summary')).toBeVisible()
  await page.getByTestId('summary-skill-bar-0').fill('10')
  await page.getByTestId('summary-skill-bar-1').fill('3')

  await expect(page.getByTestId('summary-skill-bar-0')).toHaveValue('10')
  await expect(page.getByTestId('summary-skill-bar-1')).toHaveValue('3')
  await expect(page.getByTestId('summary-skill-bar-2')).toHaveValue('5')
  await expect(page.getByTestId('summary-skill-bar-3')).toHaveValue('5')
})

test('permite cargar un CV pegando texto plano', async ({ page }) => {
test('permite cargar un CV pegando texto plano', async ({ page }) => {
  await page.goto('/')

  const resumeText = 'Experiencia con React y TypeScript'
  const resumeInput = page.getByRole('textbox', { name: 'Pegá el texto del CV' })

  await resumeInput.fill(resumeText)

  await expect(resumeInput).toHaveValue(resumeText)
})

test('permite guardar pesos individuales sin límite de suma total', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('ROL / Puesto').fill('Desarrollador')
  await page.getByLabel('Habilidades solicitadas').fill('SQL, Java, Python')
  await page.getByTestId('add-skill').click()
  await page.getByLabel('Años / seniority').fill('Senior')
  await page.getByRole('button', { name: 'Guardar requerimientos' }).click()
  await page.getByTestId('summary-skill-bar-0').fill('10')
  await page.getByTestId('summary-skill-bar-1').fill('10')
  await page.getByTestId('summary-skill-bar-2').fill('10')

  await expect(page.getByTestId('requirements-saved')).toBeVisible()
  await expect(page.getByTestId('job-requirements-summary')).toBeVisible()
  await expect(page.getByTestId('summary-skill-0')).toContainText('SQL')
  await expect(page.getByTestId('summary-seniority-bar')).toHaveValue('5')
  await expect(page.getByText(/suma.*100%/i)).toHaveCount(0)
})
