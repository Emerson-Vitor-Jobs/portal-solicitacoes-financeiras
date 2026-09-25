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
import { z } from 'zod';
import type { DashboardController } from './controller/dashboard.js';
import type { RequestController } from './controller/requests.js';
import { registerErrorHandling } from './errors.js';
import { logControllerOptions, loggerOptions, type LogStream } from './logging.js';
import { authRoutes, type AuthRouteDeps } from './router/auth.js';
import { dashboardRoutes } from './router/dashboard.js';
import { healthRoutes, type HealthDeps } from './router/health.js';
import { registerGlobalHooks } from './router/hooks.js';
import { requestRoutes } from './router/requests.js';
import { SESSION_COOKIE } from './session.js';

z.config(z.locales.ptBR());

export interface ServerDeps {
  trustProxy: string | false;
  logger?: false | { stream: LogStream };
  logLevel: string;
  health: HealthDeps;
  auth: AuthRouteDeps;
  requests: RequestController;
  dashboard: DashboardController;
}

export async function buildServer(deps: ServerDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: deps.logger === false ? false : loggerOptions(deps.logLevel, deps.logger?.stream),
    ...logControllerOptions(),
    trustProxy: deps.trustProxy,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandling(app);
  registerGlobalHooks(app);

  await app.register(fastifyCookie);
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
        securitySchemes: { cookieAuth: { type: 'apiKey', in: 'cookie', name: SESSION_COOKIE } },
      },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  await app.register(fastifySwaggerUi, { routePrefix: '/api/docs' });

  healthRoutes(app, deps.health);
  authRoutes(app, deps.auth);
  requestRoutes(app, { auth: deps.auth.service, controller: deps.requests });
  dashboardRoutes(app, { auth: deps.auth.service, controller: deps.dashboard });

  return app;
}
