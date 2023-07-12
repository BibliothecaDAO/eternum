import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from "vite-plugin-svgr";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svgr(), react()],
  resolve: {
    alias: {
      'events': 'events',
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      // external: ['micro-starknet']
    }
  },
})
