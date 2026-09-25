import { expect, test, type Page } from '@playwright/test'

const resumeText =
  'Desarrollador Frontend con experiencia en React, TypeScript y Semi Senior'

const createResumePdf = (): Buffer => {
  const content = `BT /F1 12 Tf 72 720 Td (${resumeText}) Tj ET`
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}\nendstream\nendobj\n`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []

  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(pdf, 'ascii'))
    pdf += object
  })

  const crossReferenceOffset = Buffer.byteLength(pdf, 'ascii')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${crossReferenceOffset}\n%%EOF`

  return Buffer.from(pdf, 'ascii')
}

const prepareAnalysis = async (page: Page) => {
  const evaluation = {
    candidateName: 'Candidato de prueba',
    earnedPoints: 15,
    totalPoints: 15,
    verdict: 'Apto',
    strengths: [
      'Experiencia con React: evidencia de proyectos',
      'Experiencia con TypeScript: evidencia de proyectos',
      'Perfil alineado al rol Desarrollador Frontend',
      'Seniority coincidente',
    ],
    gaps: [],
  }

  await page.route(/\/chat\/completions\?/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        choices: [{ message: { content: JSON.stringify(evaluation) } }],
      }),
    }),
  )

  await page.goto('/')
  await page
    .getByRole('textbox', { name: 'Nombre del puesto' })
    .fill('Desarrollador Frontend')

  for (const skill of ['React', 'TypeScript']) {
    await page.getByRole('textbox', { name: 'Habilidad' }).fill(skill)
    await page.getByRole('button', { name: '+ Agregar' }).click()
  }

  await page
    .getByRole('combobox', { name: 'Nivel' })
    .selectOption({ label: 'Semi Senior' })

  const fileChooserPromise = page.waitForEvent('filechooser')
  await page
    .getByRole('button', {
      name: 'Arrastrá el CV acá o hacé clic para elegirlo PDF · máx. 5 MB',
    })
    .click()
  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles({
    name: 'candidato.pdf',
    mimeType: 'application/pdf',
    buffer: createResumePdf(),
  })
}

test('calcula y muestra la compatibilidad y el veredicto', async ({ page }) => {
  await prepareAnalysis(page)

  await page.getByRole('button', { name: 'Procesar análisis' }).click()

  const results = page.getByRole('region', { name: 'Resultados del análisis' })
  await expect(results).toBeVisible()
  await expect(results).toContainText('100%')
  await expect(results).toContainText('Apto')
})

test('muestra el desglose de fortalezas y brechas', async ({ page }) => {
  await prepareAnalysis(page)

  await page.getByRole('button', { name: 'Procesar análisis' }).click()

  const results = page.getByRole('region', { name: 'Resultados del análisis' })
  await expect(results.getByRole('heading', { name: 'Fortalezas' })).toBeVisible()
  const lists = results.getByRole('list')
  await expect(lists).toHaveCount(2)
  const strengths = lists.first().getByRole('listitem')
  await expect(strengths).toHaveCount(4)
  await expect(strengths.nth(0)).toContainText('React')
  await expect(strengths.nth(1)).toContainText('TypeScript')
  await expect(strengths.nth(2)).toContainText('Perfil alineado al rol')
  await expect(strengths.nth(3)).toContainText('Seniority coincidente')
  await expect(
    results.getByRole('heading', { name: 'Brechas o habilidades faltantes' }),
  ).toBeVisible()
  await expect(lists.nth(1)).toBeEmpty()
})

test('permite cambiar entre modo claro y oscuro y conservar la elección en la sesión', async ({ page }) => {
  await page.goto('/')

  const app = page.getByRole('main')
  await expect(app).toHaveAttribute('data-theme', 'light')

  await page.getByRole('button', { name: 'Cambiar a modo oscuro' }).click()
  await expect(app).toHaveAttribute('data-theme', 'dark')

  await page.reload()
  await expect(app).toHaveAttribute('data-theme', 'dark')
})
