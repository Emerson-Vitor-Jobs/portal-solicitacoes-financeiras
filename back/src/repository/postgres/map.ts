import { CATEGORIES, ROLES, STATUSES } from '../../types/common.js';
import type { Category, Role, Status } from '../../types/common.js';

function oneOf<T extends string>(allowed: readonly T[], value: string, what: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`unknown ${what} from the database`);
  }
  return value as T;
}

export const toRole = (value: string): Role => oneOf(ROLES, value, 'role');
export const toStatus = (value: string): Status => oneOf(STATUSES, value, 'status');
export const toCategory = (value: string): Category => oneOf(CATEGORIES, value, 'category');

export function toSafeInteger(value: string): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error('integer outside the safe range from the database');
  return n;
}

export function toCompetenceDate(competence: string): string {
  return `${competence}-01`;
}

export function fromCompetenceDate(date: string): string {
  return date.slice(0, 7);
}
