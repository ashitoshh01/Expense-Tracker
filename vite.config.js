import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'firebase-vendor': ['firebase/app', 'firebase/firestore', 'firebase/auth'],
          'react-vendor': ['react', 'react-dom'],
          'lucide-vendor': ['lucide-react'],
        },
      },
    },
  },
})
