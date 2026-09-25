import { describe, expect, test } from 'vitest';
import { STATUSES, type Status } from '../types/common.js';
import { canTransition } from './transitions.js';

// A matriz inteira, escrita à mão: 3 permitidas, 13 recusadas.
const EXPECTED: Record<Status, Record<Status, boolean>> = {
  PENDING: { PENDING: false, APPROVED: true, REJECTED: true, PAID: false },
  APPROVED: { PENDING: false, APPROVED: false, REJECTED: false, PAID: true },
  REJECTED: { PENDING: false, APPROVED: false, REJECTED: false, PAID: false },
  PAID: { PENDING: false, APPROVED: false, REJECTED: false, PAID: false },
};

describe('#5 transições: matriz 4×4', () => {
  const cases = STATUSES.flatMap((from) => STATUSES.map((to) => [from, to] as const));

  test('são 16 pares', () => expect(cases).toHaveLength(16));

  test.each(cases)('%s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(EXPECTED[from][to]);
  });
});
