import { describe, expect, test } from 'vitest';
import { buildServer } from '../server.js';

describe('GET /api/health', () => {
  test('200 quando o banco responde', async () => {
    const app = await buildServer({
      trustProxy: false,
      logger: false,
      health: { ping: () => Promise.resolve() },
    });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  test('503 quando o banco não responde', async () => {
    const app = await buildServer({
      trustProxy: false,
      logger: false,
      health: { ping: () => Promise.reject(new Error('connection refused')) },
    });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'unavailable' });
  });
});
