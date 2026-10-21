import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Lets you import like: import { Button } from '@/components/ui/Button'
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Vitest config lives here so you don't need a separate file
    globals: true,
    environment: 'jsdom',
  },
})
