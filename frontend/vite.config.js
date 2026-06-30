import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import flowbiteReact from "flowbite-react/plugin/vite";

export default defineConfig({
  plugins: [react(), tailwindcss(), flowbiteReact()],
  server: {
    proxy: {
      // REST calls: /api/* → http://localhost:8000/api/*
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // WebSocket: /ws → ws://localhost:8000/ws
      '/ws': {
        target: 'http://localhost:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
