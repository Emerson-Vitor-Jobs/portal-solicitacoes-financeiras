// Roda antes de cada arquivo de integração: banco limpo antes de cada teste, pool fechado no fim.
import { afterAll, beforeEach } from 'vitest';
import { closeTestPool, testPool, truncateAll } from './db.js';

beforeEach(async () => {
  await truncateAll(testPool());
});

afterAll(async () => {
  await closeTestPool();
});
