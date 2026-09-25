import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { dashboardSummarySchema } from '../../../types/dashboard.js';
import { NotImplementedError } from '../errors.js';
import { SESSION, errors } from './contract.js';

export function dashboardRoutes(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().get('/api/dashboard/summary', {
    schema: {
      tags: ['dashboard'],
      summary: 'Indicadores (escopo pelo perfil)',
      description: 'REQUESTER: só as próprias solicitações. FINANCE: todas.',
      security: SESSION,
      response: { 200: dashboardSummarySchema, 401: errors[401], 501: errors[501] },
    },
    handler: () => {
      throw new NotImplementedError();
    },
  });
}
