import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { Config } from './config.js';
import { AuthController } from './handler/http/controller/auth.js';
import { DashboardController } from './handler/http/controller/dashboard.js';
import { RequestController } from './handler/http/controller/requests.js';
import type { LogStream } from './handler/http/logging.js';
import { buildServer } from './handler/http/server.js';
import { referenceDate } from './modules/date.js';
import { hashPassword, verifyPassword } from './modules/password.js';
import { AuthStorage } from './repository/postgres/auth_storage.js';
import { DashboardStorage } from './repository/postgres/dashboard_storage.js';
import { ping } from './repository/postgres/pool.js';
import { RequestStorage } from './repository/postgres/requests_storage.js';
import { AuthService } from './service/auth.js';
import { DashboardService } from './service/dashboard.js';
import { RequestService } from './service/requests.js';

export type AppConfig = Omit<Config, 'databaseUrl' | 'port'>;

export async function buildApp(
  pool: pg.Pool,
  config: AppConfig,
  options: { logger?: false | { stream: LogStream } } = {},
): Promise<FastifyInstance> {
  const now = () => new Date();
  const today = () => referenceDate(config.appToday, now());

  const auth = new AuthService(new AuthStorage(pool), {
    now,
    today,
    verifyPassword,
    dummyPasswordHash: await hashPassword(randomBytes(32).toString('base64url')),
  });

  const requests = new RequestService(new RequestStorage(pool), { today, now });
  const dashboard = new DashboardService(new DashboardStorage(pool), { today });

  return buildServer({
    trustProxy: config.trustedProxyIp,
    logger: options.logger,
    logLevel: config.logLevel,
    health: { ping: () => ping(pool) },
    auth: {
      service: auth,
      controller: new AuthController(auth, { secure: config.cookieSecure }),
      loginRateLimit: config.loginRateLimit,
    },
    requests: new RequestController(requests),
    dashboard: new DashboardController(dashboard),
  });
}
