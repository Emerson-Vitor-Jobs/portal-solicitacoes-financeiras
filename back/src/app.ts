// Composition root: liga storage → service → controller → rotas, com injeção manual (DECISOES_FUNDACAO §16.2).
// Fica fora do main.ts para que o gerador do contrato (scripts/gen-openapi.ts) monte exatamente o mesmo app.
import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { Config } from './config.js';
import { AuthController } from './handler/http/controller/auth.js';
import { RequestController } from './handler/http/controller/requests.js';
import type { LogStream } from './handler/http/logging.js';
import { buildServer } from './handler/http/server.js';
import { referenceDate } from './modules/date.js';
import { hashPassword, verifyPassword } from './modules/password.js';
import { AuthStorage } from './repository/postgres/auth_storage.js';
import { ping } from './repository/postgres/pool.js';
import { RequestStorage } from './repository/postgres/requests_storage.js';
import { AuthService } from './service/auth.js';
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
    // Senha aleatória descartada: o hash só existe para o login de usuário inexistente custar o mesmo (§5.2).
    dummyPasswordHash: await hashPassword(randomBytes(32).toString('base64url')),
  });

  const requests = new RequestService(new RequestStorage(pool), { today, now });

  return buildServer({
    trustProxy: config.trustProxy,
    ...(options.logger !== undefined ? { logger: options.logger } : {}),
    health: { ping: () => ping(pool) },
    auth: {
      service: auth,
      controller: new AuthController(auth, { secure: config.cookieSecure }),
      loginRateLimit: config.loginRateLimit,
    },
    requests: new RequestController(requests),
  });
}
