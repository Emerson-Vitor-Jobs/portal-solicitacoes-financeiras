import { isBusinessDate } from '../../lib/date';
import { isEnumValue, STATUS_LABELS } from '../../lib/labels';
import type { ListQuery, RequestStatus } from './api';

export const PAGE_SIZE = 20;

// Filtros e paginação vivem na URL (sobrevivem a F5 e ao voltar). O que vier inválido na URL é
// ignorado aqui, em vez de ir para a API e voltar como 422.
export type ListFilters = {
  status: RequestStatus | null;
  supplier: string;
  due_from: string | null;
  due_to: string | null;
  page: number;
};

export type FilterName = 'status' | 'supplier' | 'due_from' | 'due_to';

export function parseListParams(params: URLSearchParams): ListFilters {
  const status = params.get('status');
  const dueFrom = params.get('due_from');
  const dueTo = params.get('due_to');
  const page = params.get('page');
  return {
    status: status !== null && isEnumValue(STATUS_LABELS, status) ? status : null,
    supplier: params.get('supplier') ?? '',
    due_from: dueFrom !== null && isBusinessDate(dueFrom) ? dueFrom : null,
    due_to: dueTo !== null && isBusinessDate(dueTo) ? dueTo : null,
    page: page !== null && /^[1-9]\d{0,8}$/.test(page) ? Number(page) : 1,
  };
}

export function toListQuery(filters: ListFilters): ListQuery {
  const supplier = filters.supplier.trim();
  return {
    page: filters.page,
    page_size: PAGE_SIZE,
    ...(filters.status ? { status: filters.status } : {}),
    ...(supplier ? { supplier } : {}),
    ...(filters.due_from ? { due_from: filters.due_from } : {}),
    ...(filters.due_to ? { due_to: filters.due_to } : {}),
  };
}

// Muda um filtro e volta para a página 1.
export function withFilter(
  params: URLSearchParams,
  name: FilterName,
  value: string | null,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value === null || value === '') next.delete(name);
  else next.set(name, value);
  next.delete('page');
  return next;
}

export function withPage(params: URLSearchParams, page: number): URLSearchParams {
  const next = new URLSearchParams(params);
  if (page <= 1) next.delete('page');
  else next.set('page', String(page));
  return next;
}

export function hasAnyFilter(filters: ListFilters): boolean {
  return (
    filters.status !== null ||
    filters.supplier.trim() !== '' ||
    filters.due_from !== null ||
    filters.due_to !== null
  );
}
