import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    // Em dev, o /api vai pra API local; no Docker quem faz isso é o nginx.
    proxy: { '/api': 'http://localhost:3001' },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
    coverage: { provider: 'v8', include: ['src/**'], exclude: ['src/api/schema.d.ts'] },
  },
});
