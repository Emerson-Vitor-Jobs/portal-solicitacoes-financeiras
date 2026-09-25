// #8 dashboard contra o oráculo oficial: data/expected_results.json, com a referência 2026-09-18.
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { readDataFile } from '../support/data.js';
import { seedOfficialData, testPool } from '../support/db.js';
import { http } from '../support/http.js';
import { buildIntegrationApp } from '../support/integration_app.js';
import { loginAs } from '../support/server.js';
import { ANA, BRUNO, FERNANDA } from '../support/users.js';

interface Expected {
  reference_date: string;
  finance: Totals;
  requesters: Record<string, Totals>;
}
interface Totals {
  pending_amount_cents: number;
  approved_amount_cents: number;
  paid_this_month_amount_cents: number;
  overdue_count: number;
}

let app: FastifyInstance;
let expected: Expected;

beforeEach(async () => {
  await seedOfficialData(testPool());
  expected = await readDataFile<Expected>('expected_results.json');
  app = await buildIntegrationApp({ appToday: expected.reference_date });
});

afterEach(async () => {
  await app.close();
});

const oracleFields = (t: Totals) => ({
  pending_amount_cents: t.pending_amount_cents,
  approved_amount_cents: t.approved_amount_cents,
  paid_this_month_amount_cents: t.paid_this_month_amount_cents,
  overdue_count: t.overdue_count,
});

async function summaryAs(user: { email: string; password: string }) {
  const res = await http(app, await loginAs(app, user)).get('/api/dashboard/summary');
  expect(res.statusCode).toBe(200);
  return res.json<Totals & { reference_date: string }>();
}

describe('#8 dashboard contra o expected_results.json oficial', () => {
  test('FINANCE: os números batem exatamente', async () => {
    expect(await summaryAs(FERNANDA)).toEqual({
      ...oracleFields(expected.finance),
      reference_date: '2026-09-18',
    });
  });

  test.each([
    ['Ana', ANA],
    ['Bruno', BRUNO],
  ])('REQUESTER %s: só as próprias, batendo com o oráculo', async (_nome, user) => {
    const oracle = expected.requesters[user.id];
    expect(oracle).toBeDefined();
    expect(await summaryAs(user)).toEqual({
      ...oracleFields(oracle!),
      reference_date: '2026-09-18',
    });
  });

  test('#12 o pagamento de 31/08 fica fora de "pago no mês" (setembro)', async () => {
    // A solicitação 12 do seed foi paga em 2026-08-31T14:00-03:00: está PAID, mas não entra no número.
    const { rows } = await testPool().query<{ n: string }>(
      "SELECT amount_cents AS n FROM requests WHERE id = '20000000-0000-4000-8000-000000000012' AND status = 'PAID'",
    );
    const amount12 = Number(rows[0]?.n);
    const { rows: allPaid } = await testPool().query<{ total: string }>(
      "SELECT sum(amount_cents) AS total FROM requests WHERE status = 'PAID'",
    );
    expect(Number(allPaid[0]?.total) - amount12).toBe(
      expected.finance.paid_this_month_amount_cents,
    );
  });

  test('#12 borda do fuso: 31/08 23:59:59 em SP (já 01/09 em UTC) fica fora; 01/09 00:00 em SP entra', async () => {
    const before = await summaryAs(FERNANDA);
    // Duas aprovadas do seed viram pagas nas bordas do mês (UPDATE em requests é permitido; a auditoria não).
    const pay = (id: string, paidAt: string) =>
      testPool().query(
        "UPDATE requests SET status = 'PAID', paid_at = $2, payment_reference = 'PAG-BORDA' WHERE id = $1 RETURNING amount_cents",
        [id, paidAt],
      );
    const outside = await pay('20000000-0000-4000-8000-000000000006', '2026-08-31T23:59:59-03:00');
    const inside = await pay('20000000-0000-4000-8000-000000000007', '2026-09-01T00:00:00-03:00');
    const outsideAmount = Number((outside.rows[0] as { amount_cents: string }).amount_cents);
    const insideAmount = Number((inside.rows[0] as { amount_cents: string }).amount_cents);

    const after = await summaryAs(FERNANDA);
    expect(after.paid_this_month_amount_cents).toBe(
      before.paid_this_month_amount_cents + insideAmount,
    );
    expect(after.approved_amount_cents).toBe(
      before.approved_amount_cents - outsideAmount - insideAmount,
    );
  });

  test('sem sessão → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/dashboard/summary' });
    expect(res.statusCode).toBe(401);
  });
});
