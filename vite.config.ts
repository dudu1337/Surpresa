import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const base = '/Surpresa/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    {
      name: 'public-assets-base-path',
      enforce: 'pre',
      transform(code, id) {
        if (!id.endsWith('.tsx')) return null

        return code.replaceAll('/assets/', `${base}assets/`)
      },
    },
  ],
})
