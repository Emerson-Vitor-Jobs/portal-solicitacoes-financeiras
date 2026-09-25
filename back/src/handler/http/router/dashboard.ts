import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { AuthService } from '../../../service/auth.js';
import { dashboardSummarySchema } from '../../../types/dashboard.js';
import type { DashboardController } from '../controller/dashboard.js';
import { sessionUser } from '../request_context.js';
import { SESSION, errors } from './contract.js';
import { authenticate } from './hooks.js';

export interface DashboardRouteDeps {
  auth: AuthService;
  controller: DashboardController;
}

export function dashboardRoutes(app: FastifyInstance, deps: DashboardRouteDeps): void {
  app.withTypeProvider<ZodTypeProvider>().get('/api/dashboard/summary', {
    schema: {
      tags: ['dashboard'],
      summary: 'Indicadores (escopo pelo perfil)',
      description: 'REQUESTER: só as próprias solicitações. FINANCE: todas.',
      security: SESSION,
      response: { 200: dashboardSummarySchema, 401: errors[401] },
    },
    onRequest: authenticate(deps.auth),
    handler: (request) => deps.controller.summary(sessionUser(request)),
  });
}
