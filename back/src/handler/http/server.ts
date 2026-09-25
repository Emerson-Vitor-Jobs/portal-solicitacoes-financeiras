import Fastify, { type FastifyInstance } from 'fastify';
import { healthRoutes, type HealthDeps } from './router/health.js';

export interface ServerDeps {
  trustProxy: string | false;
  health: HealthDeps;
}

// Monta o app sem abrir porta: os testes usam app.inject().
export function buildServer(deps: ServerDeps): FastifyInstance {
  const app = Fastify({ logger: true, trustProxy: deps.trustProxy });
  healthRoutes(app, deps.health);
  return app;
}
