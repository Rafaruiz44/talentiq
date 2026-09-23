import { expect, test } from '@playwright/test'

test('valida los campos requeridos del puesto y las habilidades', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Guardar requerimientos' }).click()

  const alerts = page.getByRole('alert')
  await expect(alerts).toHaveCount(2)
  await expect(alerts).toContainText([
    'Ingresá el rol del puesto.',
    'Agregá al menos una habilidad.',
  ])
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

test('permite cargar un CV DOCX desde la zona de selección', async ({ page }) => {
  await page.goto('/')

  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', {
    name: 'Arrastrá el CV acá o hacé clic para elegirlo PDF o DOCX · máx. 5 MB',
  }).click()
  const chooser = await chooserPromise

  await chooser.setFiles({
    name: 'candidato.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: Buffer.from('CV de prueba'),
  })

  await expect(page.getByRole('button', { name: /candidato\.docx/ })).toBeVisible()
})
