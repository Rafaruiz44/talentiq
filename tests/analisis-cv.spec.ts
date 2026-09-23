import { expect, test } from '@playwright/test'

const pdfFixture = Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 68 >>
stream
BT /F1 12 Tf 72 720 Td (Desarrollador Backend SQL Senior) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
trailer
<< /Root 1 0 R >>
%%EOF`)

test('calcula y muestra la compatibilidad y el veredicto', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Nombre del puesto' }).fill('Desarrollador Backend')
  await page.getByRole('textbox', { name: 'Habilidad' }).fill('SQL')
  await page.getByTestId('add-skill').click()
  await page.getByRole('combobox', { name: 'Nivel' }).selectOption('Senior')
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /Arrastrá el CV acá/ }).click()
  const chooser = await chooserPromise
  await chooser.setFiles({ name: 'candidato.pdf', mimeType: 'application/pdf', buffer: pdfFixture })

  await page.getByRole('button', { name: 'Analizar candidato' }).click()
  await expect(page.getByTestId('analysis-loading')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Resultados del análisis' })).toBeVisible({ timeout: 10000 })
  await expect(page.getByTestId('match-score')).toContainText('%')
  await expect(page.getByTestId('evaluation-verdict')).toContainText(/Apto|No Apto/)
})

test('muestra el desglose de fortalezas y brechas', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: 'Nombre del puesto' }).fill('Desarrollador Backend')
  await page.getByRole('textbox', { name: 'Habilidad' }).fill('SQL')
  await page.getByTestId('add-skill').click()
  await page.getByRole('combobox', { name: 'Nivel' }).selectOption('Senior')
  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: /Arrastrá el CV acá/ }).click()
  const chooser = await chooserPromise
  await chooser.setFiles({ name: 'candidato.pdf', mimeType: 'application/pdf', buffer: pdfFixture })

  await page.getByRole('button', { name: 'Analizar candidato' }).click()
  const results = page.getByRole('region', { name: 'Resultados del análisis' })
  await expect(results).toBeVisible({ timeout: 10000 })
  await expect(results.getByRole('heading', { name: 'Fortalezas' })).toBeVisible()
  await expect(results.getByRole('heading', { name: 'Brechas o habilidades faltantes' })).toBeVisible()
  await expect(results.getByRole('list')).toHaveCount(2)
})
