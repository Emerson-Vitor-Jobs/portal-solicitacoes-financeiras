// Máquina de estados por tabela (DECISOES_FUNDACAO §16.2): a regra inteira de transição num lugar só.
// Estados finais (REJECTED, PAID) não saem para lugar nenhum; nada volta para PENDING.
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
