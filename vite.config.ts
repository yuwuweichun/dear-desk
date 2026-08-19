import react from '@vitejs/plugin-react'
import { readFile } from 'node:fs/promises'
import { defineConfig } from 'vitest/config'

const developmentFontFiles = new Map([
  ['/dev-fonts/YunFengJingJingTi-Regular.ttf', 'YunFengJingJingTi-Regular.ttf'],
])

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'development-font-assets',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use(async (request, response, next) => {
          const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
          const filename = developmentFontFiles.get(pathname)
          if (!filename) {
            next()
            return
          }

          try {
            const file = await readFile(new URL(`./dev-assets/fonts/${filename}`, import.meta.url))
            response.statusCode = 200
            response.setHeader('Content-Type', 'font/ttf')
            response.setHeader('Cache-Control', 'no-store')
            response.end(file)
          } catch (error) {
            next(error)
          }
        })
      },
    },
  ],
  server: {
    host: '127.0.0.1',
    port: 5164,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    clearMocks: true,
    globals: true,
    server: {
      deps: {
        inline: ['animal-island-ui'],
      },
    },
  },
})
