import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, test } from 'vitest';
import {
  CSRF,
  buildTestServer,
  loginAs,
  sessionCookieOf,
} from '../../../../test/support/server.js';
import { ANA, FERNANDA } from '../../../../test/support/users.js';

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

const login = (a: FastifyInstance, email: string, password: string) =>
  a.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: CSRF,
    payload: { email, password },
  });

describe('POST /api/auth/login', () => {
  test('200 com o usuário e o cookie sid HttpOnly, SameSite=Strict, Path=/', async () => {
    ({ app } = await buildTestServer());
    const res = await login(app, FERNANDA.email, FERNANDA.password);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      user: { id: FERNANDA.id, name: FERNANDA.name, email: FERNANDA.email, role: 'FINANCE' },
    });
    const sid = res.cookies.find((c) => c.name === 'sid');
    expect(sid).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  test('#13 usuário inexistente dá exatamente a mesma resposta que senha errada', async () => {
    ({ app } = await buildTestServer());
    const wrongPassword = await login(app, ANA.email, 'senha-errada');
    const unknownUser = await login(app, 'ninguem@gex.test', 'senha-errada');
    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownUser.statusCode).toBe(401);
    expect(unknownUser.json()).toEqual(wrongPassword.json());
    expect(wrongPassword.json()).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(wrongPassword.headers['www-authenticate']).toBeUndefined();
    expect(wrongPassword.cookies).toHaveLength(0);
  });

  test('#14 sem o header anti-CSRF → 403, mesmo com credencial certa', async () => {
    ({ app } = await buildTestServer());
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: ANA.email, password: ANA.password },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toMatchObject({ code: 'FORBIDDEN' });
    expect(res.cookies).toHaveLength(0);
  });

  test('e-mail ausente → 422', async () => {
    ({ app } = await buildTestServer());
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: CSRF,
      payload: { password: 'x' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ code: 'VALIDATION_FAILED', errors: [{ field: 'email' }] });
  });
});

describe('rate limit do login', () => {
  test('6ª tentativa no mesmo e-mail → 429 com Retry-After, mesmo para e-mail inexistente', async () => {
    ({ app } = await buildTestServer({
      loginRateLimit: { perEmail: 5, perIp: 100, windowMs: 15 * 60_000 },
    }));
    for (let i = 0; i < 5; i++) {
      // Variações de caixa caem no mesmo balde (e-mail normalizado).
      const res = await login(app, i % 2 ? 'NINGUEM@gex.test' : 'ninguem@gex.test', 'x');
      expect(res.statusCode).toBe(401);
    }
    const blocked = await login(app, 'ninguem@gex.test', 'x');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['content-type']).toContain('application/problem+json');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.json()).toMatchObject({
      type: 'about:blank',
      status: 429,
      code: 'TOO_MANY_REQUESTS',
      title: 'Too Many Requests',
    });
    // Outro e-mail, mesmo IP, ainda passa: o balde é por conta.
    expect((await login(app, ANA.email, ANA.password)).statusCode).toBe(200);
  });

  test('estoura por IP mesmo trocando o e-mail a cada tentativa', async () => {
    ({ app } = await buildTestServer({
      loginRateLimit: { perEmail: 100, perIp: 3, windowMs: 15 * 60_000 },
    }));
    for (let i = 0; i < 3; i++) {
      expect((await login(app, `conta${i}@gex.test`, 'x')).statusCode).toBe(401);
    }
    const blocked = await login(app, 'conta-nova@gex.test', 'x');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    // Outro IP não é afetado.
    const otherIp = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: CSRF,
      remoteAddress: '10.9.8.7',
      payload: { email: ANA.email, password: ANA.password },
    });
    expect(otherIp.statusCode).toBe(200);
  });
});

describe('GET /api/auth/me e POST /api/auth/logout', () => {
  test('me devolve o usuário e a data de referência do servidor', async () => {
    ({ app } = await buildTestServer({ today: () => '2026-09-18' }));
    const cookie = await loginAs(app, ANA);
    const res = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      user: { id: ANA.id, name: ANA.name, email: ANA.email, role: 'REQUESTER' },
      reference_date: '2026-09-18',
    });
  });

  test('sem sessão → 401 UNAUTHENTICATED, sem WWW-Authenticate', async () => {
    ({ app } = await buildTestServer());
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(res.headers['www-authenticate']).toBeUndefined();
  });

  test('sessão expirada (ociosa) → 401 UNAUTHENTICATED', async () => {
    let clock = Date.parse('2026-09-18T12:00:00Z');
    ({ app } = await buildTestServer({ now: () => new Date(clock) }));
    const cookie = await loginAs(app, ANA);
    clock += 30 * 60_000;
    const res = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(res.headers['www-authenticate']).toBeUndefined();
  });

  test('logout → 204, apaga o cookie e a sessão deixa de valer', async () => {
    ({ app } = await buildTestServer());
    const cookie = await loginAs(app, ANA);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie, ...CSRF },
    });
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    const cleared = res.cookies.find((c) => c.name === 'sid');
    expect(cleared?.value).toBe('');
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(401);
  });

  test('#14 logout sem o header anti-CSRF → 403 e a sessão continua', async () => {
    ({ app } = await buildTestServer());
    const cookie = await loginAs(app, ANA);
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect(res.statusCode).toBe(403);
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
  });

  test('um login novo não derruba a sessão anterior, e cada um tem o próprio token', async () => {
    ({ app } = await buildTestServer());
    const first = await loginAs(app, ANA);
    const second = sessionCookieOf(await login(app, ANA.email, ANA.password));
    expect(second).not.toBe(first);
  });
});
