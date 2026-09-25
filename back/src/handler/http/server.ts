import fastifyCookie from '@fastify/cookie';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { registerErrorHandling } from './errors.js';
import { logControllerOptions, loggerOptions, type LogStream } from './logging.js';
import { authRoutes, type AuthRouteDeps } from './router/auth.js';
import { dashboardRoutes } from './router/dashboard.js';
import { healthRoutes, type HealthDeps } from './router/health.js';
import { registerGlobalHooks } from './router/hooks.js';
import { requestRoutes } from './router/requests.js';

export interface ServerDeps {
  trustProxy: string | false;
  // false desliga o log (testes); um stream captura as linhas (teste da política de log, §14.5).
  logger?: false | { stream: LogStream };
  health: HealthDeps;
  auth: AuthRouteDeps;
}

// Monta o app sem abrir porta: os testes usam app.inject() e o gerador do OpenAPI usa app.swagger().
export async function buildServer(deps: ServerDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: deps.logger === false ? false : loggerOptions(deps.logger?.stream),
    ...logControllerOptions(),
    trustProxy: deps.trustProxy,
  });

  // Os schemas Zod das rotas validam a entrada e geram o OpenAPI (DECISOES_FUNDACAO §2).
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandling(app);
  registerGlobalHooks(app);

  await app.register(fastifyCookie);
  // Sem limite global: só o login tem baldes, montados na própria rota (router/hooks.ts, §14.6).
  await app.register(fastifyRateLimit, { global: false });

  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Portal de Solicitações Financeiras',
        version: '1.0.0',
        description:
          'Erros no formato RFC 9457 (`application/problem+json`), com `code` estável. ' +
          'Autenticação por cookie de sessão `sid`.',
      },
      components: {
        securitySchemes: { cookieAuth: { type: 'apiKey', in: 'cookie', name: 'sid' } },
      },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  await app.register(fastifySwaggerUi, { routePrefix: '/api/docs' });

  healthRoutes(app, deps.health);
  authRoutes(app, deps.auth);
  requestRoutes(app);
  dashboardRoutes(app);

  return app;
}
