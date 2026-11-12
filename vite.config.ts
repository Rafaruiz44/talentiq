import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Only VITE_* variables reach the browser bundle. Server secrets such as
  // SUPABASE_SERVICE_ROLE_KEY or AZURE_OPENAI_KEY must never use that prefix.
  envPrefix: ['VITE_'],
  server: {
    watch: {
      ignored: ['**/*.csv', '**/Resume.csv', '**/base-de-CVs/**', '**/*.pdf'],
    },
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
