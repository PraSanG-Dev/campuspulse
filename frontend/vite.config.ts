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
  build: {
    // Code-split vendor chunks to reduce initial bundle size
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Supabase client
          'vendor-supabase': ['@supabase/supabase-js'],
          // Lucide icons (large)
          'vendor-lucide': ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  test: {
    // Vitest config lives here so you don't need a separate file
    globals: true,
    environment: 'node',
  },
})
