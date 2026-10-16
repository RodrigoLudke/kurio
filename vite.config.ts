import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const mocksEnabled = env.VITE_ENABLE_MOCKS === 'true'
  return {
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      // servidor simulado importado estaticamente (baixa em paralelo ao app) só quando ativo
      'virtual:kurio-mocks': path.resolve(import.meta.dirname, mocksEnabled ? 'src/mocks/browser.ts' : 'src/mocks/disabled.ts'),
      // MSW só usa tough-cookie para cookies simulados, que esta app não usa
      'tough-cookie': path.resolve(import.meta.dirname, 'src/mocks/vendor/tough-cookie-stub.ts'),
    },
  },
  server: { port: 5173 },
  preview: { port: 4173 },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/[\\/](msw|@mswjs|@open-draft|headers-polyfill|outvariant|strict-event-emitter|is-node-process|engine\.io-parser|socket\.io-parser|graphql)[\\/]/.test(id)) return 'mocks-vendor'
            if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react'
            if (/[\\/]@tanstack[\\/]/.test(id)) return 'tanstack'
          }
          return undefined
        },
      },
    },
  },
}
})
