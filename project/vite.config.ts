import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    include: ['long', '@supabase/supabase-js', '@tensorflow/tfjs', '@tensorflow/tfjs-backend-webgl', '@tensorflow-models/blazeface'],
  },
});
