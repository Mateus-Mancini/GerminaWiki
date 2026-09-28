import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'frontend',
  plugins: [react()],
  server: { port: 5173 },
  // Static build for Firebase Hosting (firebase.json serves frontend/dist).
  build: { outDir: 'dist', emptyOutDir: true }
});
