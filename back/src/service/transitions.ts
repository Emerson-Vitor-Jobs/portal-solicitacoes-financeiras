import type { Status } from '../types/common.js';

export const TRANSITIONS: Readonly<Record<Status, readonly Status[]>> = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['PAID'],
  REJECTED: [],
  PAID: [],
};

export function canTransition(from: Status, to: Status): boolean {
  return TRANSITIONS[from].includes(to);
}
