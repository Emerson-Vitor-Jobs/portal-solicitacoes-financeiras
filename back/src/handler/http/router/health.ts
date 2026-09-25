import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

export interface HealthDeps {
  ping: () => Promise<void>;
}

export function healthRoutes(app: FastifyInstance, deps: HealthDeps): void {
  app.withTypeProvider<ZodTypeProvider>().get('/api/health', {
    schema: {
      tags: ['health'],
      summary: 'Saúde da API e do banco',
      response: {
        200: z.object({ status: z.literal('ok') }),
        503: z.object({ status: z.literal('unavailable') }),
      },
    },
    handler: async (request, reply) => {
      try {
        await deps.ping();
        return { status: 'ok' as const };
      } catch (err) {
        request.log.error({ err }, 'health: database unavailable');
        reply.code(503);
        return { status: 'unavailable' as const };
      }
    },
  });
}
