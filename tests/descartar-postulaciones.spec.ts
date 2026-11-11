import type { Page } from '@playwright/test'
import { expect, mockAuthenticatedSession, test } from './fixtures'

const position = {
  id: 'position-1',
  title: 'Desarrollador Frontend',
  seniority: 'Semi Senior',
  seniority_points: 5,
  acceptance_threshold: 70,
  status: 'Abierta',
  position_skills: [{ name: 'React', points: 5 }],
}

const evaluationRun = (
  applicationId: string,
  name: string,
  earnedPoints: number,
  stage: string | null,
) => ({
  id: `run-${applicationId}`,
  application_id: applicationId,
  candidate_id: `candidate-${applicationId}`,
  candidate_document_id: `document-${applicationId}`,
  earned_points: earnedPoints,
  total_points: 10,
  verdict: earnedPoints >= 7 ? 'Apto' : 'No Apto',
  strengths: [],
  gaps: [],
  interview_questions: [],
  evaluated_at: '2026-11-11T18:00:00.000Z',
  applications: {
    position_id: 'position-1',
    stage,
    candidates: { full_name: name },
  },
  candidate_documents: { original_file_name: `${applicationId}.pdf` },
})

// Mocks the ranking query and the stage update, keeping the stage in memory
// so a reload reflects the change like the real database would.
const mockApplications = async (page: Page) => {
  const stages: Record<string, string | null> = {
    'app-ana': 'Evaluado',
    'app-bruno': 'Evaluado',
    'app-carla': 'Descartado',
  }
  const updates: Array<{ id: string; stage: string }> = []

  await page.route('**/rest/v1/evaluation_runs?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        evaluationRun('app-ana', 'Ana Apta', 9, stages['app-ana']),
        evaluationRun('app-bruno', 'Bruno Medio', 6, stages['app-bruno']),
        evaluationRun('app-carla', 'Carla Descartada', 8, stages['app-carla']),
      ]),
    })
  })
  await page.route('**/rest/v1/applications?*', async (route) => {
    const url = new URL(route.request().url())
    const id = (url.searchParams.get('id') ?? '').replace(/^eq\./, '')
    const { stage } = route.request().postDataJSON() as { stage: string }
    expect(route.request().method()).toBe('PATCH')
    expect(url.searchParams.get('recruiter_id')).toBe(
      'eq.11111111-1111-4111-8111-111111111111',
    )
    stages[id] = stage
    updates.push({ id, stage })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id }]),
    })
  })

  return updates
}

test('el ranking oculta los descartados y permite descartar y restaurar', async ({
  page,
}) => {
  await mockAuthenticatedSession(page, [position])
  const updates = await mockApplications(page)

  await page.goto('/ranking')
  await page.getByTestId('ranking-position').selectOption('position-1')

  await expect(page.getByTestId('ranking-item')).toHaveCount(2)
  await expect(page.getByTestId('ranking-list')).not.toContainText('Carla Descartada')

  await page.getByTestId('discard-application-app-bruno').click()
  await expect(page.getByTestId('ranking-item')).toHaveCount(1)
  expect(updates).toEqual([{ id: 'app-bruno', stage: 'Descartado' }])

  await page.getByTestId('ranking-toggle-discarded').click()
  await expect(page.getByTestId('ranking-item')).toHaveCount(3)
  await expect(page.getByTestId('ranking-list')).toContainText('Carla Descartada')

  await page.getByTestId('restore-application-app-carla').click()
  await expect(page.getByTestId('discard-application-app-carla')).toBeVisible()
  expect(updates.at(-1)).toEqual({ id: 'app-carla', stage: 'Evaluado' })

  await page.getByTestId('ranking-toggle-discarded').click()
  await expect(page.getByTestId('ranking-item')).toHaveCount(2)
  await expect(page.getByTestId('ranking-list')).toContainText('Carla Descartada')
  await expect(page.getByTestId('ranking-list')).not.toContainText('Bruno Medio')
})

test('Postulaciones oculta los descartados en la lista de evaluados', async ({
  page,
}) => {
  await mockAuthenticatedSession(page, [position])
  const updates = await mockApplications(page)

  await page.goto('/postulaciones')
  await page.getByTestId('application-position').selectOption('position-1')

  const list = page.getByTestId('application-evaluated-list')
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await expect(list).not.toContainText('Carla Descartada')

  await page.getByTestId('discard-evaluated-app-ana').click()
  await expect(list.getByRole('listitem')).toHaveCount(1)
  expect(updates).toEqual([{ id: 'app-ana', stage: 'Descartado' }])

  await page.getByTestId('evaluated-toggle-discarded').click()
  await expect(list.getByRole('listitem')).toHaveCount(3)
})

test('informa el error si no se puede descartar una postulación', async ({
  page,
}) => {
  await mockAuthenticatedSession(page, [position])
  await mockApplications(page)
  await page.route('**/rest/v1/applications?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  )

  await page.goto('/ranking')
  await page.getByTestId('ranking-position').selectOption('position-1')
  await page.getByTestId('discard-application-app-bruno').click()

  await expect(page.getByTestId('ranking-stage-error')).toContainText(
    'no existe o no pertenece a esta cuenta',
  )
  await expect(page.getByTestId('ranking-item')).toHaveCount(2)
})
