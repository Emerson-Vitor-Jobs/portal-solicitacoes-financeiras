import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, test } from 'vitest';
import {
  CSRF,
  buildTestServer,
  loginAs,
  sessionCookieOf,
} from '../../../../test/support/server.js';
import { ANA, FERNANDA } from '../../../../test/support/users.js';
import { SESSION_COOKIE } from '../session.js';

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
  test('200 with the user and the sid cookie HttpOnly, SameSite=Strict, Path=/', async () => {
    ({ app } = await buildTestServer());
    const res = await login(app, FERNANDA.email, FERNANDA.password);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      user: { id: FERNANDA.id, name: FERNANDA.name, email: FERNANDA.email, role: 'FINANCE' },
    });
    const sid = res.cookies.find((c) => c.name === SESSION_COOKIE);
    expect(sid).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/' });
    expect(res.headers['cache-control']).toBe('no-store');
  });

  test('#13 an unknown user gets exactly the same response as a wrong password', async () => {
    ({ app } = await buildTestServer());
    const wrongPassword = await login(app, ANA.email, 'wrong-password');
    const unknownUser = await login(app, 'nobody@gex.test', 'wrong-password');
    expect(wrongPassword.statusCode).toBe(401);
    expect(unknownUser.statusCode).toBe(401);
    expect(unknownUser.json()).toEqual(wrongPassword.json());
    expect(wrongPassword.json()).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(wrongPassword.headers['www-authenticate']).toBeUndefined();
    expect(wrongPassword.cookies).toHaveLength(0);
  });

  test('#14 without the anti-CSRF header → 403, even with valid credentials', async () => {
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

  test('missing e-mail → 422', async () => {
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

describe('login rate limit', () => {
  test('6th attempt on the same e-mail → 429 with Retry-After, even for an unknown e-mail', async () => {
    ({ app } = await buildTestServer({
      loginRateLimit: { perEmail: 5, perIp: 100, windowMs: 15 * 60_000 },
    }));
    for (let i = 0; i < 5; i++) {
      const res = await login(app, i % 2 ? 'NOBODY@gex.test' : 'nobody@gex.test', 'x');
      expect(res.statusCode).toBe(401);
    }
    const blocked = await login(app, 'nobody@gex.test', 'x');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['content-type']).toContain('application/problem+json');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(blocked.json()).toMatchObject({
      type: 'about:blank',
      status: 429,
      code: 'TOO_MANY_REQUESTS',
      title: 'Too Many Requests',
    });
    expect((await login(app, ANA.email, ANA.password)).statusCode).toBe(200);
  });

  test('trips per IP even when the e-mail changes on every attempt', async () => {
    ({ app } = await buildTestServer({
      loginRateLimit: { perEmail: 100, perIp: 3, windowMs: 15 * 60_000 },
    }));
    for (let i = 0; i < 3; i++) {
      expect((await login(app, `account${i}@gex.test`, 'x')).statusCode).toBe(401);
    }
    const blocked = await login(app, 'new-account@gex.test', 'x');
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
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

describe('GET /api/auth/me and POST /api/auth/logout', () => {
  test('me returns the user and the server reference date', async () => {
    ({ app } = await buildTestServer({ today: () => '2026-09-18' }));
    const cookie = await loginAs(app, ANA);
    const res = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      user: { id: ANA.id, name: ANA.name, email: ANA.email, role: 'REQUESTER' },
      reference_date: '2026-09-18',
    });
  });

  test('no session → 401 UNAUTHENTICATED, no WWW-Authenticate', async () => {
    ({ app } = await buildTestServer());
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(res.headers['www-authenticate']).toBeUndefined();
  });

  test('expired (idle) session → 401 UNAUTHENTICATED', async () => {
    let clock = Date.parse('2026-09-18T12:00:00Z');
    ({ app } = await buildTestServer({ now: () => new Date(clock) }));
    const cookie = await loginAs(app, ANA);
    clock += 30 * 60_000;
    const res = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(res.headers['www-authenticate']).toBeUndefined();
  });

  test('logout → 204, clears the cookie and the session stops working', async () => {
    ({ app } = await buildTestServer());
    const cookie = await loginAs(app, ANA);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie, ...CSRF },
    });
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe('');
    const cleared = res.cookies.find((c) => c.name === SESSION_COOKIE);
    expect(cleared?.value).toBe('');
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(401);
  });

  test('#14 logout without the anti-CSRF header → 403 and the session stays', async () => {
    ({ app } = await buildTestServer());
    const cookie = await loginAs(app, ANA);
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    expect(res.statusCode).toBe(403);
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
  });

  test('a new login keeps the previous session, and each has its own token', async () => {
    ({ app } = await buildTestServer());
    const first = await loginAs(app, ANA);
    const second = sessionCookieOf(await login(app, ANA.email, ANA.password));
    expect(second).not.toBe(first);
  });
});
