import pg from 'pg';
import { ping as pingQuery } from './queries/health.queries.js';

// DATE (OID 1082) chega como string 'YYYY-MM-DD'. O padrão do driver cria um Date à meia-noite local,
// o que desloca o dia conforme o fuso (DECISOES_FUNDACAO §6.0).
pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);

export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString });
}

export async function ping(pool: pg.Pool): Promise<void> {
  await pingQuery.run(undefined, pool);
}
