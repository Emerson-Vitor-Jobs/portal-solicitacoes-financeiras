// Banco dos testes de integração: gex_finance_it (DECISOES_FUNDACAO §9.3).
import type pg from 'pg';
import { hashPassword } from '../../src/modules/password.js';
import { createPool } from '../../src/repository/postgres/pool.js';
import {
  insertSeedAuditEvent,
  insertSeedRequest,
  insertSeedUser,
} from '../../src/repository/postgres/queries/seed.queries.js';
import { withTransaction } from '../../src/repository/postgres/tx.js';
import { readDataFile } from './data.js';

// Sem DATABASE_URL o teste falha alto (não pula). E só aceita um banco *_it: o TRUNCATE nunca atinge o do app.
export function integrationDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_URL é obrigatória nos testes de integração (use npm run test:integration)',
    );
  }
  const database = new URL(url).pathname.replace(/^\//, '');
  if (!database.endsWith('_it')) {
    throw new Error(`recusando rodar integração no banco "${database}": use o gex_finance_it`);
  }
  return url;
}

let shared: pg.Pool | undefined;

export function testPool(): pg.Pool {
  shared ??= createPool(integrationDatabaseUrl());
  return shared;
}

export async function closeTestPool(): Promise<void> {
  const pool = shared;
  shared = undefined;
  if (pool) await pool.end();
}

// TRUNCATE não dispara o trigger de linha do append-only, então limpa também a auditoria.
export async function truncateAll(pool: pg.Pool): Promise<void> {
  await pool.query('TRUNCATE audit_events, sessions, requests, users CASCADE');
}

interface SeedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  seed_password: string;
}
interface SeedRequest {
  id: string;
  requester_id: string;
  supplier_name: string;
  supplier_cnpj: string;
  invoice_number: string;
  amount_cents: number;
  competence: string;
  due_date: string;
  category: string;
  description: string | null;
  status: string;
  rejection_reason: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
}
interface SeedEvent {
  id: string;
  request_id: string;
  actor_id: string;
  previous_status: string | null;
  new_status: string;
  reason: string | null;
  created_at: string;
}

// O argon2 custa ~50 ms por senha: calcula uma vez por processo.
let hashes: Promise<Map<string, string>> | undefined;

async function seedHashes(users: SeedUser[]): Promise<Map<string, string>> {
  const pairs = await Promise.all(
    users.map(async (u) => [u.id, await hashPassword(u.seed_password)] as const),
  );
  return new Map(pairs);
}

// Carrega os dados oficiais do desafio, com as mesmas queries do seed da aplicação.
// `only: 'users'` deixa o banco só com os usuários (para os testes que criam as próprias solicitações).
export async function seedOfficialData(pool: pg.Pool, only?: 'users'): Promise<void> {
  const users = await readDataFile<SeedUser[]>('seed_users.json');
  const requests = only ? [] : await readDataFile<SeedRequest[]>('seed_requests.json');
  const events = only ? [] : await readDataFile<SeedEvent[]>('seed_audit_events.json');
  hashes ??= seedHashes(users);
  const hashed = await hashes;

  await withTransaction(pool, async (client) => {
    for (const u of users) {
      await insertSeedUser.run(
        { id: u.id, name: u.name, email: u.email, role: u.role, passwordHash: hashed.get(u.id)! },
        client,
      );
    }
    for (const r of requests) {
      await insertSeedRequest.run(
        {
          id: r.id,
          requesterId: r.requester_id,
          supplierName: r.supplier_name,
          supplierCnpj: r.supplier_cnpj,
          invoiceNumber: r.invoice_number,
          amountCents: r.amount_cents,
          competence: `${r.competence}-01`,
          dueDate: r.due_date,
          category: r.category,
          description: r.description,
          status: r.status,
          rejectionReason: r.rejection_reason,
          paidAt: r.paid_at,
          paymentReference: r.payment_reference,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        },
        client,
      );
    }
    for (const e of events) {
      await insertSeedAuditEvent.run(
        {
          id: e.id,
          requestId: e.request_id,
          actorId: e.actor_id,
          previousStatus: e.previous_status,
          newStatus: e.new_status,
          reason: e.reason,
          createdAt: e.created_at,
        },
        client,
      );
    }
  });
}
