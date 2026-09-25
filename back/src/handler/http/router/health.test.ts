import { describe, expect, test } from 'vitest';
import { buildTestServer } from '../../../../test/support/server.js';

describe('GET /api/health', () => {
  test('200 quando o banco responde', async () => {
    const { app } = await buildTestServer({ health: { ping: () => Promise.resolve() } });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  test('503 quando o banco não responde', async () => {
    const { app } = await buildTestServer({
      health: { ping: () => Promise.reject(new Error('connection refused')) },
    });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'unavailable' });
  });
});
