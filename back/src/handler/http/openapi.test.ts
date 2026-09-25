import { readFile } from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { buildTestServer } from '../../../test/support/server.js';

let app: FastifyInstance;
beforeAll(async () => {
  ({ app } = await buildTestServer());
});
afterAll(() => app.close());

test('the committed openapi.json matches the routes', async () => {
  const committed: unknown = JSON.parse(
    await readFile(new URL('../../../openapi.json', import.meta.url), 'utf8'),
  );
  expect(app.swagger()).toEqual(committed);
});

test('the OpenAPI document is served at /api/docs/json', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/docs/json' });
  expect(res.statusCode).toBe(200);
  expect(res.json<{ openapi: string }>().openapi).toBe('3.1.0');
});
