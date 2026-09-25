// Conversões da borda banco → domínio usadas pelos mapX() dos storages (DECISOES_FUNDACAO §3).
// Valor fora do esperado falha alto: um CHECK do banco garante, e se um dia não garantir, o erro aparece aqui.
import { CATEGORIES, ROLES, STATUSES } from '../../types/common.js';
import type { Category, Role, Status } from '../../types/common.js';

function oneOf<T extends string>(allowed: readonly T[], value: string, what: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new Error(`${what} desconhecido vindo do banco`);
  }
  return value as T;
}

export const toRole = (value: string): Role => oneOf(ROLES, value, 'papel');
export const toStatus = (value: string): Status => oneOf(STATUSES, value, 'status');
export const toCategory = (value: string): Category => oneOf(CATEGORIES, value, 'categoria');

// BIGINT e COUNT/SUM chegam do pg como string. Só vira number se couber sem perda.
export function toSafeInteger(value: string): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) throw new Error('inteiro fora da faixa segura vindo do banco');
  return n;
}
