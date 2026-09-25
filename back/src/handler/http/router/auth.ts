import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { loginBodySchema, loginResponseSchema, meResponseSchema } from '../../../types/auth.js';
import { NotImplementedError } from '../errors.js';
import { CSRF_NOTE, SESSION, errors } from './contract.js';

export function authRoutes(app: FastifyInstance): void {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.post('/api/auth/login', {
    schema: {
      tags: ['auth'],
      summary: 'Login com e-mail e senha',
      description: `Define o cookie de sessão \`sid\`. ${CSRF_NOTE} Limite de tentativas por IP e por e-mail.`,
      body: loginBodySchema,
      response: {
        200: loginResponseSchema,
        400: errors[400],
        401: errors[401],
        403: errors[403],
        422: errors[422],
        429: errors[429],
        501: errors[501],
      },
    },
    handler: () => {
      throw new NotImplementedError();
    },
  });

  r.post('/api/auth/logout', {
    schema: {
      tags: ['auth'],
      summary: 'Encerra a sessão',
      description: CSRF_NOTE,
      security: SESSION,
      response: {
        204: z.null().describe('Sessão encerrada'),
        401: errors[401],
        403: errors[403],
        501: errors[501],
      },
    },
    handler: () => {
      throw new NotImplementedError();
    },
  });

  r.get('/api/auth/me', {
    schema: {
      tags: ['auth'],
      summary: 'Usuário da sessão e data de referência do servidor',
      security: SESSION,
      response: { 200: meResponseSchema, 401: errors[401], 501: errors[501] },
    },
    handler: () => {
      throw new NotImplementedError();
    },
  });
}
