import { expect, test } from '@playwright/test'
import { mockAuthenticatedSession } from './fixtures'

test('requiere iniciar sesión antes de acceder al espacio privado', async ({
  page,
}) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Acceso de reclutador' }),
  ).toBeVisible()
  await expect(page.getByTestId('google-sign-in')).toBeVisible()
  await expect(page.getByTestId('google-sign-in')).toContainText(
    'Ingresar con Google',
  )
  await expect(page.getByTestId('google-sign-in-icon')).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: 'Nombre del puesto' }),
  ).toHaveCount(0)
})

test('inicia el flujo OAuth con Google', async ({ page }) => {
  await page.route(
    'https://test-project.supabase.co/auth/v1/authorize**',
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: 'OAuth redirigido por prueba',
      }),
  )
  await page.goto('/')

  const authorizationRequest = page.waitForRequest((request) =>
    request.url().startsWith(
      'https://test-project.supabase.co/auth/v1/authorize',
    ),
  )
  await page.getByTestId('google-sign-in').click()
  const request = await authorizationRequest
  const authorizeUrl = new URL(request.url())

  expect(authorizeUrl.searchParams.get('provider')).toBe('google')
  expect(authorizeUrl.searchParams.get('redirect_to')).toBe(
    'http://localhost:5174',
  )
})

test('cierra sesión y oculta el espacio privado', async ({ page }) => {
  await mockAuthenticatedSession(page)
  await page.route(
    'https://test-project.supabase.co/auth/v1/logout**',
    (route) => route.fulfill({ status: 204 }),
  )
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Tus puestos' }),
  ).toBeVisible()
  await expect(page.getByTestId('signed-in-user')).toBeVisible()

  await page.getByTestId('sign-out').click()

  await expect(
    page.getByRole('heading', { name: 'Acceso de reclutador' }),
  ).toBeVisible()
  await expect(
    page.getByTestId('signed-in-user'),
  ).toHaveCount(0)
})
