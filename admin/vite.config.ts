import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// En développement : `npm run dev` relaie /api vers l'API locale (port 8098) en
// ajoutant l'identité et le secret que Traefik pose en production.
const DEV_KEY = process.env.ALDORIA_ADMIN_KEY ?? ''

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8098',
        headers: { 'Remote-User': 'parent', 'Remote-Name': 'Parent (dev)', 'X-Aldoria-Admin-Key': DEV_KEY },
      },
    },
  },
})
