import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import informer from '@entrinsik/vite-plugin-informer'
import tailwindcss from '@tailwindcss/vite'
import devWorkspace from './src/plugins/dev-workspace.js'
import path from 'path'

export default defineConfig({
  plugins: [tailwindcss(), devWorkspace(), informer(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
