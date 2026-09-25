import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type pg from 'pg';
import { z } from 'zod';
import { hashPassword } from '../../modules/password.js';
import { roleSchema, statusSchema } from '../../types/common.js';
import { competenceSchema } from '../../types/requests.js';
import { toCompetenceDate } from './map.js';
import { insertSeedAuditEvent, insertSeedRequest, insertSeedUser } from './queries/seed.queries.js';

const instant = z.iso.datetime({ offset: true });

const seedUsersSchema = z.array(
  z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    role: roleSchema,
    seed_password: z.string(),
  }),
);

const seedRequestsSchema = z.array(
  z.object({
    id: z.uuid(),
    requester_id: z.uuid(),
    supplier_name: z.string(),
    supplier_cnpj: z.string(),
    invoice_number: z.string(),
    amount_cents: z.number().int(),
    competence: competenceSchema,
    due_date: z.iso.date(),
    category: z.string(),
    description: z.string().nullable(),
    status: statusSchema,
    rejection_reason: z.string().nullable(),
    paid_at: instant.nullable(),
    payment_reference: z.string().nullable(),
    created_at: instant,
    updated_at: instant,
  }),
);

const seedEventsSchema = z.array(
  z.object({
    id: z.uuid(),
    request_id: z.uuid(),
    actor_id: z.uuid(),
    previous_status: statusSchema.nullable(),
    new_status: statusSchema,
    reason: z.string().nullable(),
    created_at: instant,
  }),
);

export type SeedUser = z.infer<typeof seedUsersSchema>[number];
export type SeedRequest = z.infer<typeof seedRequestsSchema>[number];
export type SeedEvent = z.infer<typeof seedEventsSchema>[number];

export interface SeedData {
  users: SeedUser[];
  requests: SeedRequest[];
  events: SeedEvent[];
}

export interface SeedCounts {
  users: number;
  requests: number;
  events: number;
}

async function readJson<T>(dir: string, file: string, schema: z.ZodType<T>): Promise<T> {
  const raw: unknown = JSON.parse(await readFile(join(dir, file), 'utf8'));
  return schema.parse(raw);
}

export async function readSeedData(dir: string): Promise<SeedData> {
  return {
    users: await readJson(dir, 'seed_users.json', seedUsersSchema),
    requests: await readJson(dir, 'seed_requests.json', seedRequestsSchema),
    events: await readJson(dir, 'seed_audit_events.json', seedEventsSchema),
  };
}

export async function hashSeedPasswords(users: SeedUser[]): Promise<Map<string, string>> {
  const pairs = await Promise.all(
    users.map(async (u) => [u.id, await hashPassword(u.seed_password)] as const),
  );
  return new Map(pairs);
}

export async function insertSeedData(
  client: pg.PoolClient,
  data: SeedData,
  passwordHashes: Map<string, string>,
): Promise<SeedCounts> {
  const counts: SeedCounts = { users: 0, requests: 0, events: 0 };
  for (const u of data.users) {
    const passwordHash = passwordHashes.get(u.id);
    if (passwordHash === undefined) throw new Error(`missing password hash for seed user ${u.id}`);
    const rows = await insertSeedUser.run(
      { id: u.id, name: u.name, email: u.email, role: u.role, passwordHash },
      client,
    );
    counts.users += rows.length;
  }
  for (const r of data.requests) {
    const rows = await insertSeedRequest.run(
      {
        id: r.id,
        requesterId: r.requester_id,
        supplierName: r.supplier_name,
        supplierCnpj: r.supplier_cnpj,
        invoiceNumber: r.invoice_number,
        amountCents: r.amount_cents,
        competence: toCompetenceDate(r.competence),
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
    counts.requests += rows.length;
  }
  for (const e of data.events) {
    const rows = await insertSeedAuditEvent.run(
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
    counts.events += rows.length;
  }
  return counts;
}
