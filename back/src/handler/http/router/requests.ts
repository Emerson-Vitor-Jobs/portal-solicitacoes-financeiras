import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { idParamsSchema } from '../../../types/common.js';
import {
  createRequestBodySchema,
  decisionBodySchema,
  listRequestsQuerySchema,
  markPaidBodySchema,
  requestDetailSchema,
  requestListResponseSchema,
} from '../../../types/requests.js';
import type { AuthService } from '../../../service/auth.js';
import type { RequestController } from '../controller/requests.js';
import { sessionUser } from '../request_context.js';
import { CSRF_NOTE, SESSION, errors } from './contract.js';
import { authenticate, requireRole } from './hooks.js';

export interface RequestRouteDeps {
  auth: AuthService;
  controller: RequestController;
}

export function requestRoutes(app: FastifyInstance, deps: RequestRouteDeps): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const c = deps.controller;
  // Sessão primeiro, papel depois: os dois antes de ler o corpo e de buscar o recurso (§5).
  const session = authenticate(deps.auth);
  const requester = [session, requireRole('REQUESTER')];
  const finance = [session, requireRole('FINANCE')];

  r.get('/api/requests', {
    schema: {
      tags: ['requests'],
      summary: 'Lista paginada com filtros',
      description:
        'REQUESTER vê só as próprias; FINANCE vê todas. Filtros e paginação aplicados no banco.',
      security: SESSION,
      querystring: listRequestsQuerySchema,
      response: {
        200: requestListResponseSchema,
        401: errors[401],
        422: errors[422],
      },
    },
    onRequest: session,
    handler: (request) => c.list(sessionUser(request), request.query),
  });

  r.post('/api/requests', {
    schema: {
      tags: ['requests'],
      summary: 'Cria uma solicitação (REQUESTER)',
      description: `Responde 201 com \`Location\`. ${CSRF_NOTE}`,
      security: SESSION,
      body: createRequestBodySchema,
      response: {
        201: requestDetailSchema,
        400: errors[400],
        401: errors[401],
        403: errors[403],
        409: errors[409],
        422: errors[422],
      },
    },
    onRequest: requester,
    handler: (request, reply) => c.create(sessionUser(request), request.body, reply),
  });

  r.get('/api/requests/:id', {
    schema: {
      tags: ['requests'],
      summary: 'Detalhe com histórico',
      security: SESSION,
      params: idParamsSchema,
      response: { 200: requestDetailSchema, 401: errors[401], 404: errors[404] },
    },
    onRequest: session,
    handler: (request) => c.get(sessionUser(request), request.params.id),
  });

  r.post('/api/requests/:id/decision', {
    schema: {
      tags: ['requests'],
      summary: 'Aprova ou rejeita uma solicitação pendente (FINANCE)',
      description: `Rejeitar exige \`reason\`. ${CSRF_NOTE}`,
      security: SESSION,
      params: idParamsSchema,
      body: decisionBodySchema,
      response: {
        200: requestDetailSchema,
        400: errors[400],
        401: errors[401],
        403: errors[403],
        404: errors[404],
        409: errors[409],
        422: errors[422],
      },
    },
    onRequest: finance,
    handler: (request) => c.decide(sessionUser(request), request.params.id, request.body),
  });

  r.post('/api/requests/:id/mark-paid', {
    schema: {
      tags: ['requests'],
      summary: 'Registra o pagamento de uma solicitação aprovada (FINANCE)',
      description: `\`paid_at\` não pode ser futuro nem anterior à aprovação. ${CSRF_NOTE}`,
      security: SESSION,
      params: idParamsSchema,
      body: markPaidBodySchema,
      response: {
        200: requestDetailSchema,
        400: errors[400],
        401: errors[401],
        403: errors[403],
        404: errors[404],
        409: errors[409],
        422: errors[422],
      },
    },
    onRequest: finance,
    handler: (request) => c.markPaid(sessionUser(request), request.params.id, request.body),
  });
}
