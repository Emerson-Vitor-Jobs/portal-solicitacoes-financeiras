// Carrega os dados do desafio (data/*.json) sem alterar valores, status ou datas.
// Idempotente e numa transação só: roda a cada boot; se algo falhar, nada fica pela metade.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { mustGetEnv } from './config.js';
import { hashPassword } from './modules/password.js';
import { createPool } from './repository/postgres/pool.js';
import {
  insertSeedAuditEvent,
  insertSeedRequest,
  insertSeedUser,
} from './repository/postgres/queries/seed.queries.js';
import { withTransaction } from './repository/postgres/tx.js';

// Valida a forma dos arquivos antes de tocar no banco: dado malformado falha alto, não vira linha estranha.
const status = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'PAID']);
const users = z.array(
  z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.string(),
    role: z.enum(['REQUESTER', 'FINANCE']),
    seed_password: z.string(),
  }),
);
const requests = z.array(
  z.object({
    id: z.uuid(),
    requester_id: z.uuid(),
    supplier_name: z.string(),
    supplier_cnpj: z.string(),
    invoice_number: z.string(),
    amount_cents: z.number().int(),
    competence: z.string().regex(/^\d{4}-\d{2}$/),
    due_date: z.iso.date(),
    category: z.string(),
    description: z.string().nullable(),
    status,
    rejection_reason: z.string().nullable(),
    paid_at: z.iso.datetime({ offset: true }).nullable(),
    payment_reference: z.string().nullable(),
    created_at: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),
  }),
);
const auditEvents = z.array(
  z.object({
    id: z.uuid(),
    request_id: z.uuid(),
    actor_id: z.uuid(),
    previous_status: status.nullable(),
    new_status: status,
    reason: z.string().nullable(),
    created_at: z.iso.datetime({ offset: true }),
  }),
);

async function readJson<T>(dir: string, file: string, schema: z.ZodType<T>): Promise<T> {
  const raw: unknown = JSON.parse(await readFile(join(dir, file), 'utf8'));
  return schema.parse(raw);
}

async function main(): Promise<void> {
  const dataDir = mustGetEnv('DATA_DIR');
  const pool = createPool(mustGetEnv('DATABASE_URL'));

  try {
    const seedUsers = await readJson(dataDir, 'seed_users.json', users);
    const seedRequests = await readJson(dataDir, 'seed_requests.json', requests);
    const seedEvents = await readJson(dataDir, 'seed_audit_events.json', auditEvents);

    // Hash fora da transação: é CPU pura e não precisa segurar a conexão aberta.
    const hashed = await Promise.all(
      seedUsers.map(async (u) => ({ ...u, passwordHash: await hashPassword(u.seed_password) })),
    );

    const counts = await withTransaction(pool, async (client) => {
      let usersIn = 0;
      let requestsIn = 0;
      let eventsIn = 0;
      for (const u of hashed) {
        const rows = await insertSeedUser.run(
          { id: u.id, name: u.name, email: u.email, role: u.role, passwordHash: u.passwordHash },
          client,
        );
        usersIn += rows.length;
      }
      for (const r of seedRequests) {
        const rows = await insertSeedRequest.run(
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
        requestsIn += rows.length;
      }
      for (const e of seedEvents) {
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
        eventsIn += rows.length;
      }
      return { usersIn, requestsIn, eventsIn };
    });

    console.log(
      `seed: usuários ${counts.usersIn}/${seedUsers.length}, ` +
        `solicitações ${counts.requestsIn}/${seedRequests.length}, ` +
        `eventos ${counts.eventsIn}/${seedEvents.length} inseridos (o resto já existia)`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error('seed falhou:', err);
  process.exit(1);
});
