import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'frontend',
  plugins: [react()],
  // Port 3000 is the local origin the API's CORS allows (ms-germina-wiki spec 001, FR-002).
  server: { port: 3000, strictPort: true },
  preview: { port: 3000, strictPort: true },
  // Static build for Firebase Hosting (firebase.json serves frontend/dist).
  build: { outDir: 'dist', emptyOutDir: true }
});
