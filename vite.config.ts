import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Use relative paths for GitHub Pages compatibility
  server: {
    host: '0.0.0.0'
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-reactflow': ['reactflow'],
          'vendor-ui': ['lucide-react'],
        }
      }
    }
  }
})
