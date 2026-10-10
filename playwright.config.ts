import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:5174',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node server/server.mjs',
      url: 'http://localhost:3001/health',
      reuseExistingServer: false,
      env: {
        SUPABASE_URL: 'https://test-project.supabase.co',
        SUPABASE_ANON_KEY: 'test-publishable-key',
        AZURE_OPENAI_ENDPOINT: 'https://test-azure.example.com',
        AZURE_OPENAI_KEY: 'test-server-key',
        AZURE_OPENAI_DEPLOYMENT: 'test-deployment',
        AZURE_OPENAI_API_VERSION: 'test-version',
      },
    },
    {
      command: 'npm run dev -- --port 5174 --strictPort',
      url: 'http://localhost:5174',
      reuseExistingServer: false,
      env: {
        VITE_SUPABASE_URL: 'https://test-project.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'test-publishable-key',
      },
    },
  ],
})
