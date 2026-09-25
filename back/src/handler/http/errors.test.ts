import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { CSRF, buildTestServer, loginAs } from '../../../test/support/server.js';
import { ANA, FERNANDA } from '../../../test/support/users.js';

let app: FastifyInstance;
let requester: string;
let finance: string;
beforeAll(async () => {
  ({ app } = await buildTestServer());
  requester = await loginAs(app, ANA);
  finance = await loginAs(app, FERNANDA);
});
afterAll(() => app.close());

const json = { 'content-type': 'application/json', ...CSRF };

function expectProblem(
  res: { statusCode: number; headers: Record<string, unknown>; json: () => unknown },
  status: number,
  code: string,
) {
  expect(res.statusCode).toBe(status);
  expect(res.headers['content-type']).toContain('application/problem+json');
  expect(res.json()).toMatchObject({ type: 'about:blank', status, code });
}

describe('central error handler', () => {
  test('unknown route → 404 NOT_FOUND', async () => {
    expectProblem(await app.inject({ method: 'GET', url: '/api/nothing' }), 404, 'NOT_FOUND');
  });

  test('malformed JSON → 400 VALIDATION_FAILED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: json,
      payload: '{"email":',
    });
    expectProblem(res, 400, 'VALIDATION_FAILED');
  });

  test('well-formed but invalid body → 422 with per-field errors', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { ...json, cookie: requester },
      payload: {
        supplier_name: '',
        amount_cents: 12.5,
        competence: '2026-13',
        due_date: '2026-02-30',
        category: 'X',
      },
    });
    expectProblem(res, 422, 'VALIDATION_FAILED');
    const fields = res.json<{ errors: { field: string }[] }>().errors.map((e) => e.field);
    expect(fields).toEqual(
      expect.arrayContaining([
        'supplier_name',
        'supplier_cnpj',
        'invoice_number',
        'amount_cents',
        'competence',
        'due_date',
        'category',
      ]),
    );
  });

  test('#7 rejecting without a reason → 422 on reason', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/requests/20000000-0000-4000-8000-000000000001/decision',
      headers: { ...json, cookie: finance },
      payload: { decision: 'REJECT' },
    });
    expectProblem(res, 422, 'VALIDATION_FAILED');
    expect(res.json()).toMatchObject({ errors: [{ field: 'reason' }] });
  });

  test('page_size above 100 → 422', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/requests?page_size=101',
      headers: { cookie: requester },
    });
    expectProblem(res, 422, 'VALIDATION_FAILED');
  });

  test('every documented route answers with one of its documented statuses', async () => {
    const id = '20000000-0000-4000-8000-000000000001';
    const calls = [
      { method: 'GET', url: '/api/auth/me', cookie: requester },
      { method: 'GET', url: '/api/requests', cookie: requester },
      { method: 'POST', url: '/api/requests', cookie: requester, payload: {} },
      { method: 'GET', url: `/api/requests/${id}`, cookie: requester },
      { method: 'POST', url: `/api/requests/${id}/decision`, cookie: finance, payload: {} },
      { method: 'POST', url: `/api/requests/${id}/mark-paid`, cookie: finance, payload: {} },
      { method: 'GET', url: '/api/dashboard/summary', cookie: finance },
      { method: 'POST', url: '/api/auth/login', cookie: '', payload: {} },
      { method: 'POST', url: '/api/auth/logout', cookie: finance, payload: {} },
    ] as const;
    const paths = app.swagger().paths ?? {};
    const documented = Object.keys(paths).filter((p) => p !== '/api/health');
    expect(new Set(calls.map((c) => c.url.replace(id, '{id}')))).toEqual(new Set(documented));
    for (const c of calls) {
      const operation =
        paths[c.url.replace(id, '{id}')]?.[c.method.toLowerCase() as 'get' | 'post'];
      const res = await app.inject({
        method: c.method,
        url: c.url,
        headers: { ...json, cookie: c.cookie },
        ...('payload' in c ? { payload: c.payload } : {}),
      });
      expect(Object.keys(operation?.responses ?? {}), `${c.method} ${c.url}`).toContain(
        String(res.statusCode),
      );
    }
  });
});
