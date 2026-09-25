// O app de verdade (storages PgTyped + argon2) sobre o banco de teste, para app.inject().
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import type { LogStream } from '../../src/handler/http/logging.js';
import { RELAXED_RATE_LIMIT } from './server.js';
import { testPool } from './db.js';

export async function buildIntegrationApp(
  options: { appToday?: string; logStream?: LogStream } = {},
): Promise<FastifyInstance> {
  const app = await buildApp(
    testPool(),
    {
      trustProxy: false,
      appToday: options.appToday ?? '2026-09-18',
      cookieSecure: false,
      loginRateLimit: RELAXED_RATE_LIMIT,
    },
    { logger: options.logStream ? { stream: options.logStream } : false },
  );
  await app.ready();
  return app;
}
