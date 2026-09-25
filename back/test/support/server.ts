// App HTTP montado com fakes (sem banco), para os testes com app.inject().
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { AuthController } from '../../src/handler/http/controller/auth.js';
import type { LogStream } from '../../src/handler/http/logging.js';
import type { HealthDeps } from '../../src/handler/http/router/health.js';
import type { LoginRateLimit } from '../../src/handler/http/router/hooks.js';
import { buildServer } from '../../src/handler/http/server.js';
import { AuthService } from '../../src/service/auth.js';
import { FakeAuthRepository, fakeHash, fakeVerifyPassword } from './fake_auth.js';

export const CSRF = { 'x-requested-with': 'gex-web' } as const;

// Limites altos: os testes que não são do rate limit logam várias vezes com o mesmo e-mail.
export const RELAXED_RATE_LIMIT: LoginRateLimit = { perEmail: 1000, perIp: 1000, windowMs: 60_000 };

export interface TestServerOptions {
  now?: () => Date;
  today?: () => string;
  health?: HealthDeps;
  loginRateLimit?: LoginRateLimit;
  logStream?: LogStream;
  authRepo?: FakeAuthRepository;
}

export interface TestServer {
  app: FastifyInstance;
  authRepo: FakeAuthRepository;
}

export async function buildTestServer(options: TestServerOptions = {}): Promise<TestServer> {
  const authRepo = options.authRepo ?? new FakeAuthRepository();
  const now = options.now ?? (() => new Date());
  const today = options.today ?? (() => '2026-09-18');
  const auth = new AuthService(authRepo, {
    now,
    today,
    verifyPassword: fakeVerifyPassword,
    dummyPasswordHash: fakeHash('senha-do-usuario-ficticio'),
  });
  const app = await buildServer({
    trustProxy: false,
    logger: options.logStream ? { stream: options.logStream } : false,
    health: options.health ?? { ping: () => Promise.resolve() },
    auth: {
      service: auth,
      controller: new AuthController(auth, { secure: false }),
      loginRateLimit: options.loginRateLimit ?? RELAXED_RATE_LIMIT,
    },
  });
  await app.ready();
  return { app, authRepo };
}

// Faz login pela API e devolve o header Cookie pronto para as próximas requisições.
export async function loginAs(
  app: FastifyInstance,
  user: { email: string; password: string },
): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: CSRF,
    payload: { email: user.email, password: user.password },
  });
  if (res.statusCode !== 200) throw new Error(`login falhou no teste: ${res.statusCode}`);
  return sessionCookieOf(res);
}

export function sessionCookieOf(res: LightMyRequestResponse): string {
  const sid = res.cookies.find((c) => c.name === 'sid');
  if (!sid) throw new Error('resposta sem cookie sid');
  return `sid=${sid.value}`;
}

export function expectProblemShape(res: LightMyRequestResponse): unknown {
  if (!String(res.headers['content-type']).includes('application/problem+json')) {
    throw new Error(`esperava application/problem+json, veio ${res.headers['content-type']}`);
  }
  return res.json();
}
