import { api, unwrap } from '../../api/client';
import type { components } from '../../api/schema';

export type Me = components['schemas']['Me'];
export type User = components['schemas']['User'];
export type Role = components['schemas']['Role'];
export type LoginBody = { email: string; password: string };

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
