import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // During development, send /api calls to the FastAPI backend
  server: { proxy: { '/api': 'http://localhost:8000' } },
})
