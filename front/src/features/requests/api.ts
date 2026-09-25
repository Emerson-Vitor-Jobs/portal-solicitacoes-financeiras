import { api, unwrap } from '../../api/client';
import type { components, paths } from '../../api/schema';

export type RequestDetail = components['schemas']['RequestDetail'];
export type RequestListItem = components['schemas']['RequestListItem'];
export type RequestStatus = components['schemas']['RequestStatus'];
export type Category = components['schemas']['Category'];
export type ListQuery = NonNullable<paths['/api/requests']['get']['parameters']['query']>;
export type CreateRequestBody =
  paths['/api/requests']['post']['requestBody']['content']['application/json'];
export type DecisionBody =
  paths['/api/requests/{id}/decision']['post']['requestBody']['content']['application/json'];
export type MarkPaidBody =
  paths['/api/requests/{id}/mark-paid']['post']['requestBody']['content']['application/json'];

// Chaves do cache: invalidar ['requests'] derruba lista e detalhes de uma vez.
export const requestKeys = {
  all: ['requests'] as const,
  list: (query: ListQuery) => ['requests', 'list', query] as const,
  detail: (id: string) => ['requests', 'detail', id] as const,
};

export function fetchRequests(query: ListQuery) {
  return unwrap(api.GET('/api/requests', { params: { query } }));
}

export function fetchRequest(id: string) {
  return unwrap(api.GET('/api/requests/{id}', { params: { path: { id } } }));
}

export function createRequest(body: CreateRequestBody) {
  return unwrap(api.POST('/api/requests', { body }));
}

export function decideRequest(id: string, body: DecisionBody) {
  return unwrap(api.POST('/api/requests/{id}/decision', { params: { path: { id } }, body }));
}

export function markRequestPaid(id: string, body: MarkPaidBody) {
  return unwrap(api.POST('/api/requests/{id}/mark-paid', { params: { path: { id } }, body }));
}
