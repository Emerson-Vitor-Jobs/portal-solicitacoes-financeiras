import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { seedOfficialData, testPool } from '../support/db.js';
import { VALID_REQUEST, http } from '../support/http.js';
import { buildIntegrationApp } from '../support/integration_app.js';
import { loginAs } from '../support/server.js';
import { ANA, BRUNO, FERNANDA } from '../support/users.js';

let app: FastifyInstance;
let ana: ReturnType<typeof http>;
let bruno: ReturnType<typeof http>;
let fernanda: ReturnType<typeof http>;

beforeEach(async () => {
  await seedOfficialData(testPool(), 'users');
  app = await buildIntegrationApp();
  ana = http(app, await loginAs(app, ANA));
  bruno = http(app, await loginAs(app, BRUNO));
  fernanda = http(app, await loginAs(app, FERNANDA));
});

afterEach(async () => {
  await app.close();
});

async function countRows(sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await testPool().query<{ n: string }>(sql, params);
  return Number(rows[0]?.n);
}

const requestsWithInvoice = (invoice: string) =>
  countRows('SELECT count(*) AS n FROM requests WHERE invoice_number = $1', [invoice]);

async function createAsAna(overrides: object = {}): Promise<string> {
  const res = await ana.post('/api/requests', { ...VALID_REQUEST, ...overrides });
  expect(res.statusCode).toBe(201);
  return res.json<{ id: string }>().id;
}

describe('creation', () => {
  test('201 + Location, with normalized CNPJ and invoice and the creation event', async () => {
    const res = await ana.post('/api/requests', {
      ...VALID_REQUEST,
      invoice_number: '  nf-2026-9001 ',
    });
    expect(res.statusCode).toBe(201);
    const body = res.json<{ id: string }>();
    expect(res.headers.location).toBe(`/api/requests/${body.id}`);
    expect(body).toMatchObject({
      supplier_cnpj: '10000000000145',
      invoice_number: 'NF-2026-9001',
      amount_cents: 155313,
      status: 'PENDING',
      requester: { id: ANA.id, name: ANA.name },
      history: [{ previous_status: null, new_status: 'PENDING', actor: { id: ANA.id } }],
    });
  });

  test('#2 duplicate invoice (same CNPJ and invoice, written differently) → 409, no extra row', async () => {
    await createAsAna();
    const dup = await bruno.post('/api/requests', {
      ...VALID_REQUEST,
      supplier_cnpj: '10000000000145',
      invoice_number: 'nf-2026-9001',
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json()).toMatchObject({ code: 'DUPLICATE_INVOICE', status: 409 });
    expect(await requestsWithInvoice('NF-2026-9001')).toBe(1);
    expect(await countRows('SELECT count(*) AS n FROM audit_events')).toBe(1);
  });

  test('#3 two simultaneous duplicate creations → 1 created, 1 gets 409, 1 row in the database', async () => {
    for (let round = 0; round < 5; round++) {
      const invoice = `NF-CORRIDA-${round}`;
      const payload = { ...VALID_REQUEST, invoice_number: invoice };
      const results = await Promise.all([
        ana.post('/api/requests', payload),
        bruno.post('/api/requests', payload),
      ]);
      expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
      expect(results.find((r) => r.statusCode === 409)?.json()).toMatchObject({
        code: 'DUPLICATE_INVOICE',
      });
      expect(await requestsWithInvoice(invoice)).toBe(1);
    }
    expect(await countRows('SELECT count(*) AS n FROM audit_events')).toBe(5);
  });

  test('CNPJ with a wrong check digit → 422 on supplier_cnpj', async () => {
    const res = await ana.post('/api/requests', {
      ...VALID_REQUEST,
      supplier_cnpj: '10.000.000/0001-46',
    });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [{ field: 'supplier_cnpj' }],
    });
  });

  test('#12 DATE and competence come back exactly as sent', async () => {
    const id = await createAsAna({ due_date: '2026-01-01', competence: '2026-12' });
    const res = await ana.get(`/api/requests/${id}`);
    expect(res.json()).toMatchObject({ due_date: '2026-01-01', competence: '2026-12' });
    const { rows } = await testPool().query<{ competence: string }>(
      'SELECT competence FROM requests WHERE id = $1',
      [id],
    );
    expect(rows[0]?.competence).toBe('2026-12-01');
  });
});

describe('decision and payment', () => {
  test('#6 approve × reject at the same time → 1 wins, 1 gets 409, 1 decision event', async () => {
    for (let round = 0; round < 5; round++) {
      const id = await createAsAna({ invoice_number: `NF-DECISAO-${round}` });
      const [approve, reject] = await Promise.all([
        fernanda.post(`/api/requests/${id}/decision`, { decision: 'APPROVE' }),
        fernanda.post(`/api/requests/${id}/decision`, { decision: 'REJECT', reason: 'duplicate' }),
      ]);
      expect([approve.statusCode, reject.statusCode].sort()).toEqual([200, 409]);
      const loser = approve.statusCode === 409 ? approve : reject;
      const winner = approve.statusCode === 200 ? 'APPROVED' : 'REJECTED';
      expect(loser.json()).toMatchObject({ code: 'INVALID_TRANSITION' });
      expect(loser.json<{ detail: string }>().detail).toContain(winner);
      expect(
        await countRows(
          'SELECT count(*) AS n FROM audit_events WHERE request_id = $1 AND previous_status IS NOT NULL',
          [id],
        ),
      ).toBe(1);
      const { rows } = await testPool().query<{ status: string }>(
        'SELECT status FROM requests WHERE id = $1',
        [id],
      );
      expect(rows[0]?.status).toBe(winner);
    }
  });

  test('#4 REQUESTER trying to approve, reject or pay → 403 and nothing changes', async () => {
    const id = await createAsAna();
    const attempts = [
      await ana.post(`/api/requests/${id}/decision`, { decision: 'APPROVE' }),
      await ana.post(`/api/requests/${id}/decision`, { decision: 'REJECT', reason: 'x' }),
      await ana.post(`/api/requests/${id}/mark-paid`, {
        paid_at: '2026-09-18T10:00:00-03:00',
        payment_reference: 'PAG-1',
      }),
    ];
    for (const res of attempts) {
      expect(res.statusCode).toBe(403);
      expect(res.json()).toMatchObject({ code: 'FORBIDDEN' });
    }
    expect(await countRows('SELECT count(*) AS n FROM audit_events')).toBe(1);
  });

  test('#4 the role is checked before loading the resource: REQUESTER gets 403 even for an unknown id', async () => {
    const res = await ana.post('/api/requests/20000000-0000-4000-8000-00000000ffff/decision', {
      decision: 'APPROVE',
    });
    expect(res.statusCode).toBe(403);
  });

  test('FINANCE cannot create a request → 403', async () => {
    const res = await fernanda.post('/api/requests', VALID_REQUEST);
    expect(res.statusCode).toBe(403);
  });

  test('#7 rejecting without a reason → 422 and the request stays PENDING', async () => {
    const id = await createAsAna();
    const res = await fernanda.post(`/api/requests/${id}/decision`, { decision: 'REJECT' });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ errors: [{ field: 'reason' }] });
    expect((await ana.get(`/api/requests/${id}`)).json()).toMatchObject({ status: 'PENDING' });
  });

  test('#14 paid_at in the future or before the approval → 422 on paid_at', async () => {
    const id = await createAsAna();
    const approved = await fernanda.post(`/api/requests/${id}/decision`, { decision: 'APPROVE' });
    const approvedAt = Date.parse(
      approved.json<{ history: { created_at: string }[] }>().history.at(-1)!.created_at,
    );

    const beforeApproval = await fernanda.post(`/api/requests/${id}/mark-paid`, {
      paid_at: new Date(approvedAt - 60_000).toISOString(),
      payment_reference: 'PAG-1',
    });
    expect(beforeApproval.statusCode).toBe(422);
    expect(beforeApproval.json()).toMatchObject({ errors: [{ field: 'paid_at' }] });

    const future = await fernanda.post(`/api/requests/${id}/mark-paid`, {
      paid_at: new Date(Date.now() + 60_000).toISOString(),
      payment_reference: 'PAG-1',
    });
    expect(future.statusCode).toBe(422);
    expect(future.json()).toMatchObject({ errors: [{ field: 'paid_at' }] });

    const noOffset = await fernanda.post(`/api/requests/${id}/mark-paid`, {
      paid_at: '2026-09-18T10:00:00',
      payment_reference: 'PAG-1',
    });
    expect(noOffset.statusCode).toBe(422);

    expect((await ana.get(`/api/requests/${id}`)).json()).toMatchObject({
      status: 'APPROVED',
      paid_at: null,
    });

    const now = await fernanda.post(`/api/requests/${id}/mark-paid`, {
      paid_at: new Date().toISOString(),
      payment_reference: 'PAG-1',
    });
    expect(now.statusCode).toBe(200);
    expect(now.json()).toMatchObject({ status: 'PAID' });
  });

  test('#14 without the anti-CSRF header → 403 and nothing is created', async () => {
    const cookie = await loginAs(app, ANA);
    const res = await app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie },
      payload: VALID_REQUEST,
    });
    expect(res.statusCode).toBe(403);
    expect(await countRows('SELECT count(*) AS n FROM requests')).toBe(0);
  });
});

describe('detail and scope', () => {
  test('#13 another person request → 404, same as unknown and non-UUID ids', async () => {
    const id = await createAsAna();
    const othersRequest = await bruno.get(`/api/requests/${id}`);
    const unknownRequest = await bruno.get('/api/requests/20000000-0000-4000-8000-00000000ffff');
    const nonUuidRequest = await bruno.get('/api/requests/abc');
    for (const res of [othersRequest, unknownRequest, nonUuidRequest])
      expect(res.statusCode).toBe(404);
    expect(othersRequest.json()).toEqual(unknownRequest.json());
    expect(nonUuidRequest.json()).toEqual(unknownRequest.json());
    expect((await ana.get(`/api/requests/${id}`)).statusCode).toBe(200);
    expect((await fernanda.get(`/api/requests/${id}`)).statusCode).toBe(200);
  });

  test('no session → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/requests' });
    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toBeUndefined();
  });
});

describe('#15 append-only audit trail', () => {
  test('UPDATE and DELETE on audit_events fail in the database', async () => {
    await createAsAna();
    await expect(testPool().query("UPDATE audit_events SET reason = 'x'")).rejects.toMatchObject({
      code: '42501',
    });
    await expect(testPool().query('DELETE FROM audit_events')).rejects.toMatchObject({
      code: '42501',
    });
    expect(await countRows('SELECT count(*) AS n FROM audit_events')).toBe(1);
  });
});
