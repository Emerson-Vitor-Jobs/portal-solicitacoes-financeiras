import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: { provider: 'v8', include: ['src/**'], exclude: ['**/*.queries.ts'] },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['**/*.integration.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/**/*.integration.test.ts'],
          setupFiles: ['test/support/integration_setup.ts'],
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 20_000,
        },
      },
    ],
  },
});
