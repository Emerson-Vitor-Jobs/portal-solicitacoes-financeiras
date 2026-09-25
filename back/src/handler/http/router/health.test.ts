import { describe, expect, test } from 'vitest';
import { buildTestServer } from '../../../../test/support/server.js';

describe('GET /api/health', () => {
  test('200 when the database answers', async () => {
    const { app } = await buildTestServer({ health: { ping: () => Promise.resolve() } });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  test('503 when the database does not answer', async () => {
    const { app } = await buildTestServer({
      health: { ping: () => Promise.reject(new Error('connection refused')) },
    });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'unavailable' });
    await app.close();
  });
});
