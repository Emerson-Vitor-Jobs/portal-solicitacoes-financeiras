import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

export interface HealthDeps {
  ping: () => Promise<void>;
}

// GET /api/health: usado pelo healthcheck do compose. Responde 503 se o banco não responde.
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
        return await reply.code(200).send({ status: 'ok' });
      } catch (err) {
        request.log.error({ err: { name: (err as Error).name } }, 'health: banco indisponível');
        return await reply.code(503).send({ status: 'unavailable' });
      }
    },
  });
}
