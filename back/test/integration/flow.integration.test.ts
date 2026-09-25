import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { serializeError } from '../../src/handler/http/logging.js';
import { seedOfficialData, testPool } from '../support/db.js';
import { VALID_REQUEST, http } from '../support/http.js';
import { buildIntegrationApp } from '../support/integration_app.js';
import { LogCapture } from '../support/log_capture.js';
import { loginAs } from '../support/server.js';
import { ANA, FERNANDA } from '../support/users.js';

interface Detail {
  id: string;
  status: string;
  paid_at: string | null;
  payment_reference: string | null;
  updated_at: string;
  due_date: string;
  history: {
    previous_status: string | null;
    new_status: string;
    actor: { id: string };
    reason: string | null;
    created_at: string;
  }[];
}

let app: FastifyInstance;
let logs: LogCapture;

beforeEach(async () => {
  await seedOfficialData(testPool(), 'users');
  logs = new LogCapture();
  app = await buildIntegrationApp({ logStream: logs });
});

afterEach(async () => {
  await app.close();
});

describe('#9 full flow with audit trail', () => {
  test('create → approve → pay; history with 3 events in order; paid_at is the informed one', async () => {
    const ana = http(app, await loginAs(app, ANA));
    const fernanda = http(app, await loginAs(app, FERNANDA));

    const created = await ana.post('/api/requests', VALID_REQUEST);
    expect(created.statusCode).toBe(201);
    const { id } = created.json<Detail>();

    const approved = await fernanda.post(`/api/requests/${id}/decision`, { decision: 'APPROVE' });
    expect(approved.statusCode).toBe(200);
    expect(approved.json()).toMatchObject({ status: 'APPROVED' });
    const approvedAt = Date.parse(approved.json<Detail>().history.at(-1)!.created_at);

    const paidAt = new Date(approvedAt).toISOString();
    const paid = await fernanda.post(`/api/requests/${id}/mark-paid`, {
      paid_at: paidAt,
      payment_reference: ' PAG-2026-9001 ',
    });
    expect(paid.statusCode).toBe(200);

    const detail = (await ana.get(`/api/requests/${id}`)).json<Detail>();
    expect(detail).toMatchObject({
      status: 'PAID',
      paid_at: paidAt,
      payment_reference: 'PAG-2026-9001',
      due_date: VALID_REQUEST.due_date,
    });
    expect(detail.history.map((e) => [e.previous_status, e.new_status])).toEqual([
      [null, 'PENDING'],
      ['PENDING', 'APPROVED'],
      ['APPROVED', 'PAID'],
    ]);
    expect(detail.history.map((e) => e.actor.id)).toEqual([ANA.id, FERNANDA.id, FERNANDA.id]);
    expect(detail.history[2]?.reason).toBe('PAG-2026-9001');
    const paidEvent = detail.history[2]!;
    expect(paidEvent.created_at).not.toBe(detail.paid_at);
    expect(detail.updated_at).toBe(paidEvent.created_at);

    const again = await fernanda.post(`/api/requests/${id}/decision`, { decision: 'APPROVE' });
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ code: 'INVALID_TRANSITION' });
  });
});

describe('log policy with a real database error (§14.5)', () => {
  test('the provoked 23505 leaves no CNPJ, invoice or amount in the log', async () => {
    const ana = http(app, await loginAs(app, ANA));
    expect((await ana.post('/api/requests', VALID_REQUEST)).statusCode).toBe(201);
    expect((await ana.post('/api/requests', VALID_REQUEST)).statusCode).toBe(409);

    const raw = await testPool()
      .query(
        `INSERT INTO requests (id, requester_id, supplier_name, supplier_cnpj, invoice_number, amount_cents,
                               competence, due_date, category, status)
         VALUES (gen_random_uuid(), $1, 'X', '10000000000145', 'NF-2026-9001', 155313, '2026-09-01',
                 '2026-09-30', 'SOFTWARE', 'PENDING')`,
        [ANA.id],
      )
      .catch((e: unknown) => e);
    expect(raw).toBeInstanceOf(pg.DatabaseError);
    expect((raw as pg.DatabaseError).detail).toContain('10000000000145');
    expect(serializeError(raw)).toEqual({ name: 'error', code: '23505' });

    const text = logs.text;
    expect(text).toContain('"status":409');
    for (const secret of ['10000000000145', '10.000.000/0001-45', 'NF-2026-9001', '155313']) {
      expect(text).not.toContain(secret);
    }
  });
});
