import type { Category, RequestStatus, Role } from '../api/types';
import { palette } from '../theme';

export const STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovada',
  REJECTED: 'Rejeitada',
  PAID: 'Paga',
};

export const STATUS_COLORS: Record<RequestStatus, string> = {
  PENDING: palette.yellow,
  APPROVED: palette.blue,
  REJECTED: palette.pink,
  PAID: palette.green,
};

export const CATEGORY_LABELS: Record<Category, string> = {
  INFRAESTRUTURA: 'Infraestrutura',
  MARKETING: 'Marketing',
  SERVIÇOS: 'Serviços',
  SOFTWARE: 'Software',
};

export const ROLE_LABELS: Record<Role, string> = {
  REQUESTER: 'Solicitante',
  FINANCE: 'Financeiro',
};

export function enumValues<K extends string>(labels: Record<K, string>): K[] {
  return Object.keys(labels) as K[];
}

export function enumOptions<K extends string>(
  labels: Record<K, string>,
): { value: K; label: string }[] {
  return enumValues(labels).map((value) => ({ value, label: labels[value] }));
}

export function isEnumValue<K extends string>(
  labels: Record<K, string>,
  value: string,
): value is K {
  return Object.hasOwn(labels, value);
}
