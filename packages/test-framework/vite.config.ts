import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import devWorkspace from './src/plugins/dev-workspace.js'
import { resolve } from 'node:path'

export default defineConfig({
  base: './',
  plugins: [
    tailwindcss(),
    devWorkspace(),
    react(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
