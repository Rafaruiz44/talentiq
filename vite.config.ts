import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'SUPABASE_'],
  server: {
    watch: {
      ignored: ['**/*.csv', '**/Resume.csv', '**/base-de-CVs/**', '**/*.pdf'],
    },
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
