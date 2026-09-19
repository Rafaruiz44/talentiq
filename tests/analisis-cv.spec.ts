import { expect, test } from '@playwright/test'

test('calcula y muestra la compatibilidad y el veredicto', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('textbox', { name: 'Rol' }).fill('Desarrollador Frontend')
  await page
    .getByRole('textbox', { name: 'Tecnologías excluyentes' })
    .fill('React, TypeScript')
  await page.getByRole('textbox', { name: 'Años / seniority' }).fill('Semi Senior')
  await page
    .getByRole('textbox', { name: 'Pegá el texto del CV' })
    .fill('Desarrollador Frontend con experiencia en React, TypeScript y Semi Senior')

  await page.getByRole('button', { name: 'Procesar análisis' }).click()

  const results = page.getByRole('region', { name: 'Resultados del análisis' })
  await expect(results).toBeVisible()
  await expect(results).toContainText('100%')
  await expect(results).toContainText('Apto')
})

test('muestra el desglose de fortalezas y brechas', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('textbox', { name: 'Rol' }).fill('Desarrollador Frontend')
  await page
    .getByRole('textbox', { name: 'Tecnologías excluyentes' })
    .fill('React, TypeScript')
  await page.getByRole('textbox', { name: 'Años / seniority' }).fill('Semi Senior')
  await page
    .getByRole('textbox', { name: 'Pegá el texto del CV' })
    .fill('Desarrollador Frontend con experiencia en React, TypeScript y Semi Senior')

  await page.getByRole('button', { name: 'Procesar análisis' }).click()

  const results = page.getByRole('region', { name: 'Resultados del análisis' })
  await expect(results.getByRole('heading', { name: 'Fortalezas' })).toBeVisible()
  const lists = results.getByRole('list')
  await expect(lists).toHaveCount(2)
  const strengths = lists.first().getByRole('listitem')
  await expect(strengths).toHaveCount(4)
  await expect(strengths.nth(0)).toHaveText('Experiencia con React')
  await expect(strengths.nth(1)).toHaveText('Experiencia con TypeScript')
  await expect(strengths.nth(2)).toHaveText(
    'Perfil alineado al rol Desarrollador Frontend',
  )
  await expect(strengths.nth(3)).toHaveText('Seniority coincidente: Semi Senior')
  await expect(
    results.getByRole('heading', { name: 'Brechas o habilidades faltantes' }),
  ).toBeVisible()
  await expect(lists.nth(1)).toBeEmpty()
})

test('permite cambiar entre modo claro y oscuro y conservar la elección en la sesión', async ({ page }) => {
  await page.goto('/')

  const app = page.locator('main')
  await expect(app).toHaveAttribute('data-theme', 'light')

  await page.getByRole('button', { name: 'Cambiar a modo oscuro' }).click()
  await expect(app).toHaveAttribute('data-theme', 'dark')

  await page.reload()
  await expect(app).toHaveAttribute('data-theme', 'dark')
})
