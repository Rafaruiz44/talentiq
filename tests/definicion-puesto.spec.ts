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
