// GET /api/requests sobre o seed oficial: filtros e paginação no banco, escopo por papel (§4b, §7.3).
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { SeedRequest } from '../../src/repository/postgres/seed_data.js';
import { readDataFile } from '../support/data.js';
import { seedOfficialData, testPool } from '../support/db.js';
import { VALID_REQUEST, http } from '../support/http.js';
import { buildIntegrationApp } from '../support/integration_app.js';
import { loginAs } from '../support/server.js';
import { ANA, FERNANDA } from '../support/users.js';

interface ListBody {
  data: {
    id: string;
    supplier_name: string;
    due_date: string;
    status: string;
    is_overdue: boolean;
    requester: { id: string };
  }[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  reference_date: string;
}

let app: FastifyInstance;
let fernanda: ReturnType<typeof http>;
let ana: ReturnType<typeof http>;
let seed: SeedRequest[];

beforeEach(async () => {
  await seedOfficialData(testPool());
  seed = await readDataFile<SeedRequest[]>('seed_requests.json');
  app = await buildIntegrationApp({ appToday: '2026-09-18' });
  fernanda = http(app, await loginAs(app, FERNANDA));
  ana = http(app, await loginAs(app, ANA));
});

afterEach(async () => {
  await app.close();
});

const list = async (client: ReturnType<typeof http>, query = '') => {
  const res = await client.get(`/api/requests${query}`);
  expect(res.statusCode).toBe(200);
  return res.json<ListBody>();
};

describe('lista', () => {
  test('FINANCE vê as 16, ordenadas por created_at DESC, com reference_date no envelope', async () => {
    const body = await list(fernanda, '?page_size=100');
    expect(body).toMatchObject({ total: 16, page: 1, page_size: 100, total_pages: 1 });
    expect(body.reference_date).toBe('2026-09-18');
    const expectedOrder = [...seed]
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .map((r) => r.id);
    expect(body.data.map((r) => r.id)).toEqual(expectedOrder);
    // #12 com a referência 18/09: as 4 vencidas do oráculo (vence hoje não conta).
    expect(body.data.filter((r) => r.is_overdue)).toHaveLength(4);
  });

  test('REQUESTER vê só as próprias', async () => {
    const body = await list(ana, '?page_size=100');
    expect(body.total).toBe(8);
    expect(body.data.every((r) => r.requester.id === ANA.id)).toBe(true);
  });

  test('filtro por status', async () => {
    const body = await list(fernanda, '?status=PENDING');
    expect(body.total).toBe(5);
    expect(body.data.every((r) => r.status === 'PENDING')).toBe(true);
  });

  test('busca por fornecedor ignora acento e caixa: "servicos" acha "Serviços"', async () => {
    const body = await list(fernanda, '?supplier=SERVICOS');
    expect(body.total).toBe(2);
    expect(body.data.every((r) => r.supplier_name === 'Aurora Serviços Digitais')).toBe(true);
    expect((await list(fernanda, `?supplier=${encodeURIComponent('comunicação')}`)).total).toBe(2);
  });

  test('curingas digitados são literais: "%" e "_" não casam tudo', async () => {
    expect((await list(fernanda, `?supplier=${encodeURIComponent('%')}`)).total).toBe(0);
    expect((await list(fernanda, '?supplier=_')).total).toBe(0);
    expect((await list(fernanda, `?supplier=${encodeURIComponent('\\')}`)).total).toBe(0);
    // E um nome que tem o caractere de verdade é achado.
    const cookie = await loginAs(app, ANA);
    await http(app, cookie).post('/api/requests', {
      ...VALID_REQUEST,
      supplier_name: 'Loja 100% Digital',
    });
    expect((await list(fernanda, `?supplier=${encodeURIComponent('100%')}`)).total).toBe(1);
  });

  test('período de vencimento é inclusivo nas duas pontas', async () => {
    const body = await list(fernanda, '?due_from=2026-09-10&due_to=2026-09-18&page_size=100');
    const expected = seed.filter((r) => r.due_date >= '2026-09-10' && r.due_date <= '2026-09-18');
    expect(body.total).toBe(expected.length);
    expect(body.data.map((r) => r.due_date)).toEqual(
      expect.arrayContaining(['2026-09-10', '2026-09-18']),
    );
    expect((await list(fernanda, '?due_from=2026-09-24')).total).toBe(
      seed.filter((r) => r.due_date >= '2026-09-24').length,
    );
  });

  test('filtros combinados com escopo', async () => {
    const body = await list(ana, '?status=PAID&supplier=verde');
    expect(body.total).toBe(1);
    expect(body.data[0]).toMatchObject({ supplier_name: 'Verde Nuvem Tecnologia', status: 'PAID' });
  });

  test('paginação: páginas sem sobreposição; além da última → data vazia com o total certo', async () => {
    const pages = await Promise.all(
      [1, 2, 3, 4].map((p) => list(fernanda, `?page=${p}&page_size=5`)),
    );
    expect(pages.map((p) => p.data.length)).toEqual([5, 5, 5, 1]);
    expect(pages.every((p) => p.total === 16 && p.total_pages === 4)).toBe(true);
    expect(new Set(pages.flatMap((p) => p.data.map((r) => r.id))).size).toBe(16);
    const beyond = await list(fernanda, '?page=9&page_size=5');
    expect(beyond).toMatchObject({ data: [], total: 16, total_pages: 4, page: 9 });
  });

  test('#12 as datas do seed voltam sem deslocamento de fuso', async () => {
    const body = await list(fernanda, '?page_size=100');
    const byId = new Map(seed.map((r) => [r.id, r.due_date]));
    for (const r of body.data) expect(r.due_date).toBe(byId.get(r.id));
  });
});
