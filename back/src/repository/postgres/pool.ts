import pg from 'pg';
import { ping as pingQuery } from './queries/health.queries.js';

const keepDateAsString = (value: string) => value;
pg.types.setTypeParser(pg.types.builtins.DATE, keepDateAsString);

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString });
}

export async function ping(pool: pg.Pool): Promise<void> {
  await pingQuery.run(undefined, pool);
}
