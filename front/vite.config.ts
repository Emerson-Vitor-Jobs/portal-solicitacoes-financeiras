import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const LOCAL_API_URL = 'http://localhost:3001';
const SLOW_UI_TEST_TIMEOUT_MS = 20_000;

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': LOCAL_API_URL },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: SLOW_UI_TEST_TIMEOUT_MS,
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/api/schema.d.ts', 'src/test/**'],
    },
  },
});
