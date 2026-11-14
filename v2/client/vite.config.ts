import { createReadStream, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// Contenus partagés avec l'API (content/ : lieux, régions, vecteurs de test) : importés tels
// quels, jamais recopiés dans le client.
const content = fileURLToPath(new URL('../content', import.meta.url))

/** CSP du jeu, identique à celle de deploy/nginx/web.conf. */
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

/**
 * Outils que Babylon.js charge à la demande pour WebGPU (glslang et twgsl : traduction d'un
 * shader GLSL en WGSL), pris dans le paquet installé (même version que le moteur) et servis par
 * le site sous /ressources/babylon/ (src/game/engine.ts) : jamais depuis le CDN de Babylon.js,
 * que la CSP refuse. Copiés dans le build, servis tels quels par `npm run dev`.
 */
export const BABYLON_TOOLS = ['glslang/glslang.js', 'glslang/glslang.wasm', 'twgsl/twgsl.js', 'twgsl/twgsl.wasm']

function babylonTools(): Plugin {
  const source = fileURLToPath(new URL('./node_modules/@babylonjs/core/assets/', import.meta.url))
  return {
    name: 'aldoria-babylon-tools',
    configureServer(server) {
      server.middlewares.use('/ressources/babylon/', (req, res, next) => {
        const file = BABYLON_TOOLS.find((f) => req.url === `/${f}`)
        if (!file) return next()
        res.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript')
        createReadStream(source + file).pipe(res)
      })
    },
    generateBundle() {
      for (const file of BABYLON_TOOLS) {
        this.emitFile({ type: 'asset', fileName: `ressources/babylon/${file}`, source: readFileSync(source + file) })
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), babylonTools()],
  resolve: { alias: { '@content': content } },
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    // `npm run dev` relaie /api vers l'API locale (Docker, port 8098), comme la v1.
    proxy: { '/api': 'http://127.0.0.1:8098' },
  },
  // Prévisualisation du build avec la même CSP que nginx (deploy/nginx/web.conf) : les tests
  // dans le navigateur échouent si un module injecte un style ou appelle un serveur tiers.
  // Adresse IPv4 explicite : sur les runners Ubuntu 24.04, « localhost » se résout en ::1 et le
  // serveur n'écoutait pas sur 127.0.0.1, l'adresse attendue par la CI et e2e/smoke.mjs.
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, headers: { 'Content-Security-Policy': CSP } },
  build: {
    outDir: 'dist',
    // Fichiers produits par Vite (nommés par empreinte) : /assets/. Fichiers statiques
    // (modèles 3D, polices, sons) : /ressources/, servis sans empreinte (revalidés).
    assetsDir: 'assets',
    // Jamais de fichier intégré en data: (petites polices de KaTeX) : la CSP les refuse.
    assetsInlineLimit: 0,
    sourcemap: true,
    chunkSizeWarningLimit: 8000,
    rollupOptions: {
      output: {
        // Babylon.js à part : l'écran titre s'affiche avant que le moteur 3D soit chargé.
        manualChunks(id) {
          if (id.includes('node_modules/@babylonjs')) return 'babylon'
          if (id.includes('node_modules/katex')) return 'katex'
          return undefined
        },
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
