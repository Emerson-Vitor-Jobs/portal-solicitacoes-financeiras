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
      trustedProxyIp: false,
      appToday: options.appToday ?? '2026-09-18',
      cookieSecure: false,
      loginRateLimit: RELAXED_RATE_LIMIT,
      logLevel: 'info',
    },
    { logger: options.logStream ? { stream: options.logStream } : false },
  );
  await app.ready();
  return app;
}
