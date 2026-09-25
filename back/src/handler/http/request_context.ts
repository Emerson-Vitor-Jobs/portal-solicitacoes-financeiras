// O usuário da sessão, preso à requisição pelo hook `authenticate` (router/hooks.ts).
import type { FastifyRequest } from 'fastify';
import { UnauthenticatedError } from '../../service/errors.js';
import type { User } from '../../types/domain.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null;
  }
}

// Para os handlers de rotas protegidas. Sem usuário aqui, o hook não rodou: é bug de fiação, e a resposta
// segura é 401, nunca seguir como anônimo.
export function sessionUser(request: FastifyRequest): User {
  if (request.user === null) throw new UnauthenticatedError();
  return request.user;
}
