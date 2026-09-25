import { api, unwrap } from '../../api/client';
import type { components, paths } from '../../api/schema';

export type Me = components['schemas']['Me'];
export type LoginBody =
  paths['/api/auth/login']['post']['requestBody']['content']['application/json'];

export const sessionQueryKey = ['session'] as const;

export function fetchMe() {
  return unwrap(api.GET('/api/auth/me'));
}

export function login(body: LoginBody) {
  return unwrap(api.POST('/api/auth/login', { body }));
}

export function logout() {
  return unwrap(api.POST('/api/auth/logout'));
}
