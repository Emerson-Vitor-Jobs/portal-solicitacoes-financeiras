import type { FastifyRequest } from 'fastify';
import { UnauthenticatedError } from '../../service/errors.js';
import type { User } from '../../types/domain.js';
import { SESSION_COOKIE } from './session.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null;
  }
}

export function sessionUser(request: FastifyRequest): User {
  if (request.user === null) throw new UnauthenticatedError();
  return request.user;
}

export function sessionToken(request: FastifyRequest): string {
  const token = request.cookies[SESSION_COOKIE];
  if (token === undefined || token === '') throw new UnauthenticatedError();
  return token;
}
