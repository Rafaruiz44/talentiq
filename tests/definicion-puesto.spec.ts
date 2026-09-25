import { expect, test } from '@playwright/test'

test('mantiene deshabilitado el análisis hasta completar los datos requeridos', async ({ page }) => {
  await page.goto('/')

  const analyzeButton = page.getByRole('button', { name: 'Procesar análisis' })
  await expect(analyzeButton).toBeDisabled()

  await page.getByRole('textbox', { name: 'Nombre del puesto' }).fill('Desarrollador Backend')
  await expect(analyzeButton).toBeDisabled()

  await page.getByRole('textbox', { name: 'Habilidad' }).fill('SQL')
  await page.getByRole('button', { name: '+ Agregar' }).click()
  await page.getByRole('combobox', { name: 'Nivel' }).selectOption({ label: 'Semi Senior' })
  await expect(analyzeButton).toBeDisabled()
})

test('agrega una habilidad con su peso individual', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('textbox', { name: 'Nombre del puesto' }).fill('Desarrollador Backend')
  await page.getByRole('textbox', { name: 'Habilidad' }).fill('SQL')
  await page.getByTestId('skill-points').fill('8')
  await page.getByRole('button', { name: '+ Agregar' }).click()

  await expect(page.getByRole('textbox', { name: 'Habilidad' })).toHaveValue('')
  await expect(page.getByRole('listitem')).toContainText('SQL')
  await expect(page.getByRole('listitem')).toContainText('8')
})

test('permite modificar el peso de una habilidad ya agregada', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('textbox', { name: 'Habilidad' }).fill('SQL')
  await page.getByRole('button', { name: '+ Agregar' }).click()
  await page.getByTestId('skill-weight-0').fill('9')

  await expect(page.getByTestId('skill-weight-0')).toHaveValue('9')
  await expect(page.getByTestId('skills-list').getByRole('listitem')).toContainText('9')
})

test('permite cargar un CV PDF desde la zona de selección', async ({ page }) => {
  await page.goto('/')

  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', {
    name: 'Arrastrá el CV acá o hacé clic para elegirlo PDF · máx. 5 MB',
  }).click()
  const chooser = await chooserPromise

  await chooser.setFiles({
    name: 'candidato.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 CV de prueba'),
  })

  await expect(page.getByTestId('candidate-resume-file')).toHaveValue(/candidato\.pdf/)
})
