import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { buildServer } from './server.js';

// Contrato de erro (RFC 9457) exercido pelas rotas ainda não implementadas (DECISOES_FUNDACAO §4a, §5).
let app: FastifyInstance;
beforeAll(async () => {
  app = await buildServer({
    trustProxy: false,
    logger: false,
    health: { ping: () => Promise.resolve() },
  });
  await app.ready();
});
afterAll(() => app.close());

const json = { 'content-type': 'application/json' };

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
      headers: json,
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
      headers: json,
      payload: { decision: 'REJECT' },
    });
    expectProblem(res, 422, 'VALIDATION_FAILED');
    expect(res.json()).toMatchObject({ errors: [{ field: 'reason' }] });
  });

  test('page_size acima de 100 → 422', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/requests?page_size=101' });
    expectProblem(res, 422, 'VALIDATION_FAILED');
  });

  test('rota do contrato ainda sem implementação → 501 NOT_IMPLEMENTED', async () => {
    expectProblem(
      await app.inject({ method: 'GET', url: '/api/dashboard/summary' }),
      501,
      'NOT_IMPLEMENTED',
    );
  });

  test('o OpenAPI é servido em /api/docs/json', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ openapi: string }>().openapi).toBe('3.1.0');
  });
});
