import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { LoginRateLimit } from '../../../config.js';
import type { AuthService } from '../../../service/auth.js';
import { loginBodySchema, loginResponseSchema, meResponseSchema } from '../../../types/auth.js';
import type { AuthController } from '../controller/auth.js';
import { sessionToken, sessionUser } from '../request_context.js';
import { CSRF_NOTE, SESSION, errors } from './contract.js';
import { authenticate, loginRateLimit } from './hooks.js';

export interface AuthRouteDeps {
  service: AuthService;
  controller: AuthController;
  loginRateLimit: LoginRateLimit;
}

export function authRoutes(app: FastifyInstance, deps: AuthRouteDeps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const session = authenticate(deps.service);

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
      },
    },
    preHandler: loginRateLimit(app, deps.loginRateLimit),
    handler: (request, reply) => deps.controller.login(request.body, reply),
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
      },
    },
    onRequest: session,
    handler: async (request, reply) => {
      await deps.controller.logout(sessionToken(request), reply);
      return reply.code(204).send(null);
    },
  });

  r.get('/api/auth/me', {
    schema: {
      tags: ['auth'],
      summary: 'Usuário da sessão e data de referência do servidor',
      security: SESSION,
      response: { 200: meResponseSchema, 401: errors[401] },
    },
    onRequest: session,
    handler: (request) => deps.controller.me(sessionUser(request)),
  });
}
