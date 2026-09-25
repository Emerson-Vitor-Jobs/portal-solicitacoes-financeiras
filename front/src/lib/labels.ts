import type { components } from '../api/schema';
import { palette } from '../theme';

type Status = components['schemas']['RequestStatus'];
type Category = components['schemas']['Category'];
type Role = components['schemas']['Role'];

// `Record<Enum, …>` obriga uma entrada por valor do enum gerado: se o back mudar a lista, o front
// deixa de compilar aqui. O front não mantém uma lista própria dos valores (§7.1).
export const STATUS_LABELS: Record<Status, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovada',
  REJECTED: 'Rejeitada',
  PAID: 'Paga',
};

// Acentos pastel do sistema visual; o texto escuro por cima vem do autoContrast do tema (§17).
export const STATUS_COLORS: Record<Status, string> = {
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

// As chaves do Record viram a lista de valores (a ordem é a da declaração acima).
export function enumValues<K extends string>(labels: Record<K, string>): K[] {
  return Object.keys(labels) as K[];
}

export function isEnumValue<K extends string>(
  labels: Record<K, string>,
  value: string,
): value is K {
  return Object.hasOwn(labels, value);
}
