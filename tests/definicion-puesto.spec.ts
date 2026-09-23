import { expect, test } from '@playwright/test'

test('valida los campos requeridos de la definición del puesto', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Guardar requerimientos' }).click()

  const alerts = page.getByRole('alert')

  await expect(alerts).toHaveCount(3)
  await expect(alerts).toContainText([
    'Ingresá el rol del puesto.',
    'Ingresá al menos una tecnología excluyente.',
    'Ingresá los años o el seniority requerido.',
  ])
})

test('permite cargar un CV pegando texto plano', async ({ page }) => {
  await page.goto('/')

  const resumeText = 'Experiencia con React y TypeScript'
  const resumeInput = page.getByRole('textbox', { name: 'Pegá el texto del CV' })

  await resumeInput.fill(resumeText)

  await expect(resumeInput).toHaveValue(resumeText)
})

test('exige que los pesos de los requerimientos sumen 100%', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Peso del rol').fill('50')
  await page.getByLabel('Peso de tecnologías').fill('30')
  await page.getByLabel('Peso del seniority').fill('10')

  await page.getByRole('button', { name: 'Guardar requerimientos' }).click()

  await expect(page.getByTestId('weights-total')).toHaveText(
    'Total de pesos: 90%',
  )
  await expect(
    page.getByText('Los pesos deben sumar exactamente 100%.'),
  ).toBeVisible()
  await expect(page.getByTestId('run-analysis')).toBeDisabled()
})
