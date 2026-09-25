// Solicitações contra o Postgres real: duplicidade e corrida no UNIQUE, corrida de decisões no compare-and-set,
// auditoria append-only, papel e escopo pela API.
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

describe('criação', () => {
  test('201 + Location, com CNPJ e nota normalizados e o evento de criação', async () => {
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

  test('#2 nota duplicada (mesmo CNPJ e nota, escritos de outro jeito) → 409, nenhum registro extra', async () => {
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

  test('#3 duas criações duplicadas simultâneas → 1 criada, 1 recebe 409, 1 linha no banco', async () => {
    for (let round = 0; round < 5; round++) {
      const invoice = `NF-CORRIDA-${round}`;
      const payload = { ...VALID_REQUEST, invoice_number: invoice };
      // Cada requisição pega a própria conexão do pool: é o UNIQUE de verdade que decide.
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
    // Um evento de criação por solicitação criada, nenhum do perdedor.
    expect(await countRows('SELECT count(*) AS n FROM audit_events')).toBe(5);
  });

  test('CNPJ com DV errado → 422 no campo supplier_cnpj', async () => {
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

  test('#12 DATE e competência voltam exatamente como foram enviados', async () => {
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

describe('decisão e pagamento', () => {
  test('#6 aprovar × rejeitar ao mesmo tempo → 1 vence, 1 recebe 409, 1 evento de decisão', async () => {
    for (let round = 0; round < 5; round++) {
      const id = await createAsAna({ invoice_number: `NF-DECISAO-${round}` });
      const [approve, reject] = await Promise.all([
        fernanda.post(`/api/requests/${id}/decision`, { decision: 'APPROVE' }),
        fernanda.post(`/api/requests/${id}/decision`, { decision: 'REJECT', reason: 'duplicada' }),
      ]);
      expect([approve.statusCode, reject.statusCode].sort()).toEqual([200, 409]);
      const loser = approve.statusCode === 409 ? approve : reject;
      const winner = approve.statusCode === 200 ? 'APPROVED' : 'REJECTED';
      expect(loser.json()).toMatchObject({ code: 'INVALID_TRANSITION' });
      // O detail do perdedor diz o status que venceu (§5.5).
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

  test('#4 REQUESTER tentando aprovar, rejeitar ou pagar → 403, e nada muda', async () => {
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

  test('#4 o papel é checado antes de buscar o recurso: REQUESTER recebe 403 até para id inexistente', async () => {
    const res = await ana.post('/api/requests/20000000-0000-4000-8000-00000000ffff/decision', {
      decision: 'APPROVE',
    });
    expect(res.statusCode).toBe(403);
  });

  test('FINANCE não cria solicitação → 403', async () => {
    const res = await fernanda.post('/api/requests', VALID_REQUEST);
    expect(res.statusCode).toBe(403);
  });

  test('#7 rejeitar sem motivo → 422 e a solicitação continua PENDING', async () => {
    const id = await createAsAna();
    const res = await fernanda.post(`/api/requests/${id}/decision`, { decision: 'REJECT' });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ errors: [{ field: 'reason' }] });
    expect((await ana.get(`/api/requests/${id}`)).json()).toMatchObject({ status: 'PENDING' });
  });

  test('#14 paid_at futuro ou anterior à aprovação → 422 no campo paid_at', async () => {
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

    // Sem offset (horário local ambíguo) nem chega ao service.
    const noOffset = await fernanda.post(`/api/requests/${id}/mark-paid`, {
      paid_at: '2026-09-18T10:00:00',
      payment_reference: 'PAG-1',
    });
    expect(noOffset.statusCode).toBe(422);

    expect((await ana.get(`/api/requests/${id}`)).json()).toMatchObject({
      status: 'APPROVED',
      paid_at: null,
    });

    // APP_TODAY (18/09) no passado e aprovação agora: pagar agora passa (o caso que a 1ª versão da §6.3 barrava).
    const now = await fernanda.post(`/api/requests/${id}/mark-paid`, {
      paid_at: new Date().toISOString(),
      payment_reference: 'PAG-1',
    });
    expect(now.statusCode).toBe(200);
    expect(now.json()).toMatchObject({ status: 'PAID' });
  });

  test('#14 sem o header anti-CSRF → 403 e nada é criado', async () => {
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

describe('detalhe e escopo', () => {
  test('#13 solicitação alheia → 404, igual a inexistente e a id que não é UUID', async () => {
    const id = await createAsAna();
    const alheia = await bruno.get(`/api/requests/${id}`);
    const inexistente = await bruno.get('/api/requests/20000000-0000-4000-8000-00000000ffff');
    const naoUuid = await bruno.get('/api/requests/abc');
    for (const res of [alheia, inexistente, naoUuid]) expect(res.statusCode).toBe(404);
    expect(alheia.json()).toEqual(inexistente.json());
    expect(naoUuid.json()).toEqual(inexistente.json());
    expect((await ana.get(`/api/requests/${id}`)).statusCode).toBe(200);
    expect((await fernanda.get(`/api/requests/${id}`)).statusCode).toBe(200);
  });

  test('sem sessão → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/requests' });
    expect(res.statusCode).toBe(401);
    expect(res.headers['www-authenticate']).toBeUndefined();
  });
});

describe('#15 auditoria append-only', () => {
  test('UPDATE e DELETE em audit_events falham no banco', async () => {
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
