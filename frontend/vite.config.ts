import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: 'frontend',
  plugins: [react()],
  // Port 3000 is the local origin the API's CORS allows (ms-germina-wiki spec 001, FR-002).
  server: { port: 3000, strictPort: true },
  preview: { port: 3000, strictPort: true },
  // Static build for Firebase Hosting (firebase.json serves frontend/dist).
  build: { outDir: 'dist', emptyOutDir: true },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    // Component tests mount a full BlockNote editor in jsdom: about 1-2 s each alone, but near the 5 s
    // default when the machine is busy, which made them fail at random.
    testTimeout: 15_000
  }
});
