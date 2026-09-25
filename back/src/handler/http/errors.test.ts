import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { CSRF, buildTestServer, loginAs } from '../../../test/support/server.js';
import { ANA, FERNANDA } from '../../../test/support/users.js';

// Contrato de erro (RFC 9457) exercido pelas rotas ainda não implementadas (DECISOES_FUNDACAO §4a, §5).
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

describe('handler central de erro', () => {
  test('rota inexistente → 404 NOT_FOUND', async () => {
    expectProblem(await app.inject({ method: 'GET', url: '/api/nada' }), 404, 'NOT_FOUND');
  });

  test('JSON quebrado → 400 VALIDATION_FAILED', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: json,
      payload: '{"email":',
    });
    expectProblem(res, 400, 'VALIDATION_FAILED');
  });

  test('corpo bem formado mas inválido → 422 com erro por campo', async () => {
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

  test('#7 rejeitar sem motivo → 422 no campo reason', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/requests/20000000-0000-4000-8000-000000000001/decision',
      headers: { ...json, cookie: finance },
      payload: { decision: 'REJECT' },
    });
    expectProblem(res, 422, 'VALIDATION_FAILED');
    expect(res.json()).toMatchObject({ errors: [{ field: 'reason' }] });
  });

  test('page_size acima de 100 → 422', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/requests?page_size=101',
      headers: { cookie: requester },
    });
    expectProblem(res, 422, 'VALIDATION_FAILED');
  });

  test('nenhuma rota do contrato responde 501 (todas implementadas)', async () => {
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
    // Cobre todas as rotas do openapi.json: se uma rota nova aparecer no contrato, este teste precisa dela.
    const documented = Object.keys(app.swagger().paths ?? {}).filter((p) => p !== '/api/health');
    expect(new Set(calls.map((c) => c.url.replace(id, '{id}')))).toEqual(new Set(documented));
    for (const c of calls) {
      const res = await app.inject({
        method: c.method,
        url: c.url,
        headers: { ...json, cookie: c.cookie },
        ...('payload' in c ? { payload: c.payload } : {}),
      });
      expect(res.statusCode, `${c.method} ${c.url}`).not.toBe(501);
    }
  });

  test('o OpenAPI é servido em /api/docs/json', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ openapi: string }>().openapi).toBe('3.1.0');
  });
});
