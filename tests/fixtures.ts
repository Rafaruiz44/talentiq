import { expect, test as base, type Page } from '@playwright/test'

const testUserId = '11111111-1111-4111-8111-111111111111'
const testEmail = 'reclutador@example.com'

interface PositionFixture {
  id: string
  title: string
  seniority: string
  seniority_points: number
  acceptance_threshold: number
  status: string
  position_skills: Array<{ name: string; points: number }>
}

export const mockAuthenticatedSession = async (
  page: Page,
  positions: PositionFixture[] = [],
) => {
  await page.route('**/rest/v1/positions?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(positions),
    }),
  )

  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + 60 * 60
  const jwtHeader = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url')
  const jwtPayload = Buffer.from(
    JSON.stringify({
      aud: 'authenticated',
      email: testEmail,
      exp: expiresAt,
      iat: issuedAt,
      role: 'authenticated',
      sub: testUserId,
    }),
  ).toString('base64url')
  const accessToken = `${jwtHeader}.${jwtPayload}.test-signature`

  await page.addInitScript(
    ({ storageKey, session }) => {
      localStorage.setItem(storageKey, JSON.stringify(session))
    },
    {
      storageKey: 'sb-test-project-auth-token',
      session: {
        access_token: accessToken,
        expires_at: expiresAt,
        expires_in: 60 * 60,
        refresh_token: 'test-refresh-token',
        token_type: 'bearer',
        user: {
          app_metadata: { provider: 'google', providers: ['google'] },
          aud: 'authenticated',
          email: testEmail,
          id: testUserId,
          user_metadata: { full_name: 'Reclutador de prueba' },
        },
      },
    },
  )
}

export { expect }
export const test = base

// The real /api/evaluation-runs answers with the persisted score and verdict.
// Mocks echo the values sent by the client so the UI receives a valid contract.
export const savedScoreFrom = (postData: string | null) => {
  const { evaluation } = JSON.parse(postData ?? '{}') as {
    evaluation?: { earnedPoints?: number; totalPoints?: number; verdict?: string }
  }
  return {
    earnedPoints: evaluation?.earnedPoints,
    totalPoints: evaluation?.totalPoints,
    verdict: evaluation?.verdict,
  }
}
