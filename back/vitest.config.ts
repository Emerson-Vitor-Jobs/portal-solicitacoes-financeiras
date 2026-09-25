import { defineConfig } from 'vitest/config';

// Dois projetos (DECISOES_FUNDACAO §9.3): `unit` (fakes, sem banco) e `integration` (Postgres real, em série,
// banco limpo antes de cada teste). `npm test` roda os dois; sem DATABASE_URL a integração FALHA, não pula.
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
          // Os arquivos compartilham o mesmo banco: um de cada vez.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 20_000,
        },
      },
    ],
  },
});
