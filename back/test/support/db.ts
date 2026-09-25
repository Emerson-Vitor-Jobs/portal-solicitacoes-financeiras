import type pg from 'pg';
import { createPool } from '../../src/repository/postgres/pool.js';
import {
  hashSeedPasswords,
  insertSeedData,
  readSeedData,
} from '../../src/repository/postgres/seed_data.js';
import { withTransaction } from '../../src/repository/postgres/tx.js';
import { DATA_DIR } from './data.js';

export function integrationDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_URL is required by the integration tests (use npm run test:integration)',
    );
  }
  const database = new URL(url).pathname.replace(/^\//, '');
  if (!database.endsWith('_it')) {
    throw new Error(
      `refusing to run integration tests on database "${database}": use gex_finance_it`,
    );
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

export async function truncateAll(pool: pg.Pool): Promise<void> {
  await pool.query('TRUNCATE audit_events, sessions, requests, users CASCADE');
}

let passwordHashes: Promise<Map<string, string>> | undefined;

export async function seedOfficialData(pool: pg.Pool, only?: 'users'): Promise<void> {
  const data = await readSeedData(DATA_DIR);
  passwordHashes ??= hashSeedPasswords(data.users);
  const hashes = await passwordHashes;
  const selected = only ? { ...data, requests: [], events: [] } : data;
  await withTransaction(pool, (client) => insertSeedData(client, selected, hashes));
}
