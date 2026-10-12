import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En développement : `npm run dev` relaie /api vers l'API locale (port 8098) en
// ajoutant le secret que Traefik pose en production ; on s'y connecte avec un compte
// adulte du banc (python -m app.cli create-adult …).
const DEV_KEY = process.env.ALDORIA_ADMIN_KEY ?? ''

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8098',
        headers: { 'X-Aldoria-Admin-Key': DEV_KEY },
      },
    },
  },
})
