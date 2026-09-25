import { afterAll, beforeEach } from 'vitest';
import { closeTestPool, testPool, truncateAll } from './db.js';

beforeEach(async () => {
  await truncateAll(testPool());
});

afterAll(async () => {
  await closeTestPool();
});
