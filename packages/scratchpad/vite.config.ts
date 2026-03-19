import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import informer from '@entrinsik/vite-plugin-informer';

// https://vite.dev/config/
export default defineConfig({
  plugins: [informer(), react()],
})
