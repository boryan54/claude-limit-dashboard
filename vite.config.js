import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Фронтенд живёт в web/. В dev Vite поднимается как middleware внутри Express
// (единый порт, без межпроцессного прокси). В prod собирается в web/dist.
export default defineConfig({
  root: 'web',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
