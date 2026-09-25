import { mustGetEnv } from './config.js';
import { createPool } from './repository/postgres/pool.js';
import {
  hashSeedPasswords,
  insertSeedData,
  readSeedData,
} from './repository/postgres/seed_data.js';
import { withTransaction } from './repository/postgres/tx.js';

async function main(): Promise<void> {
  const data = await readSeedData(mustGetEnv('DATA_DIR'));
  const pool = createPool(mustGetEnv('DATABASE_URL'));

  try {
    const passwordHashes = await hashSeedPasswords(data.users);
    const inserted = await withTransaction(pool, (client) =>
      insertSeedData(client, data, passwordHashes),
    );
    console.log(
      `seed: users ${inserted.users}/${data.users.length}, ` +
        `requests ${inserted.requests}/${data.requests.length}, ` +
        `events ${inserted.events}/${data.events.length} inserted (the rest already existed)`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error('seed failed:', err);
  process.exit(1);
});
