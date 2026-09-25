import type { FastifyInstance } from 'fastify';

export interface HealthDeps {
  ping: () => Promise<void>;
}

// GET /api/health: usado pelo healthcheck do compose. Responde 503 se o banco não responde.
export function healthRoutes(app: FastifyInstance, deps: HealthDeps): void {
  app.get('/api/health', async (request, reply) => {
    try {
      await deps.ping();
      return await reply.send({ status: 'ok' });
    } catch (err) {
      request.log.error({ err: { name: (err as Error).name } }, 'health: banco indisponível');
      return await reply.code(503).send({ status: 'unavailable' });
    }
  });
}
