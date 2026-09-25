import type pg from 'pg';

export type IsolationLevel = 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';

// Executa `fn` numa transação: COMMIT se terminar, ROLLBACK se lançar (e o erro segue pro chamador).
export async function withTransaction<T>(
  pool: pg.Pool,
  fn: (client: pg.PoolClient) => Promise<T>,
  options: { isolation?: IsolationLevel; readOnly?: boolean } = {},
): Promise<T> {
  const client = await pool.connect();
  try {
    const mode = [
      `ISOLATION LEVEL ${options.isolation ?? 'READ COMMITTED'}`,
      options.readOnly ? 'READ ONLY' : 'READ WRITE',
    ].join(' ');
    await client.query(`BEGIN ${mode}`);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
