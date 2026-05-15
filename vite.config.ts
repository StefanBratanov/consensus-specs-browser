import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE ?? '/consensus-specs-browser/',
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
});
