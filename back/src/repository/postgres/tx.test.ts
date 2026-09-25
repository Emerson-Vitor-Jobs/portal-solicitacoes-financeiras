import type pg from 'pg';
import { describe, expect, test } from 'vitest';
import { withTransaction } from './tx.js';

class FakeClient {
  readonly statements: string[] = [];
  released: { called: boolean; error?: Error | boolean } = { called: false };

  constructor(private readonly failOn?: string) {}

  query(sql: string): Promise<void> {
    this.statements.push(sql);
    if (sql === this.failOn) return Promise.reject(new Error(`${sql} failed`));
    return Promise.resolve();
  }

  release(error?: Error | boolean): void {
    this.released = { called: true, error };
  }
}

function poolWith(client: FakeClient): pg.Pool {
  return { connect: () => Promise.resolve(client) } as unknown as pg.Pool;
}

describe('withTransaction', () => {
  test('commits and returns the result, releasing the connection back to the pool', async () => {
    const client = new FakeClient();

    const result = await withTransaction(poolWith(client), () => Promise.resolve(42));

    expect(result).toBe(42);
    expect(client.statements).toEqual([
      'BEGIN ISOLATION LEVEL READ COMMITTED READ WRITE',
      'COMMIT',
    ]);
    expect(client.released).toEqual({ called: true, error: undefined });
  });

  test('rolls back and rethrows the original error', async () => {
    const client = new FakeClient();
    const original = new Error('business failure');

    await expect(withTransaction(poolWith(client), () => Promise.reject(original))).rejects.toBe(
      original,
    );

    expect(client.statements.at(-1)).toBe('ROLLBACK');
    expect(client.released).toEqual({ called: true, error: undefined });
  });

  test('a failed ROLLBACK keeps the original error and discards the broken connection', async () => {
    const client = new FakeClient('ROLLBACK');
    const original = new Error('business failure');

    await expect(withTransaction(poolWith(client), () => Promise.reject(original))).rejects.toBe(
      original,
    );

    expect(client.released.called).toBe(true);
    expect(client.released.error).toBeInstanceOf(Error);
    expect((client.released.error as Error).message).toBe('ROLLBACK failed');
  });
});
