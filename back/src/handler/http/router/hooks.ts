import type {
  FastifyInstance,
  FastifyRequest,
  onRequestAsyncHookHandler,
  onRequestHookHandler,
  preHandlerAsyncHookHandler,
} from 'fastify';
import type { LoginRateLimit } from '../../../config.js';
import { normalizeEmail, type AuthService } from '../../../service/auth.js';
import { ForbiddenError } from '../../../service/errors.js';
import type { Role } from '../../../types/common.js';
import { TooManyAttemptsError } from '../errors.js';
import { sessionUser } from '../request_context.js';
import { CSRF_HEADER, CSRF_VALUE, SESSION_COOKIE } from '../session.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const csrf: onRequestHookHandler = (request, _reply, done) => {
  if (!SAFE_METHODS.has(request.method) && request.headers[CSRF_HEADER] !== CSRF_VALUE) {
    done(new ForbiddenError('Requisição sem o header anti-CSRF.'));
    return;
  }
  done();
};

export function authenticate(auth: AuthService): onRequestAsyncHookHandler {
  return async (request) => {
    request.user = await auth.authenticate(request.cookies[SESSION_COOKIE]);
  };
}

export function requireRole(role: Role): onRequestHookHandler {
  return (request, _reply, done) => {
    if (sessionUser(request).role !== role) {
      done(new ForbiddenError());
      return;
    }
    done();
  };
}

export function loginRateLimit(
  app: FastifyInstance,
  limits: LoginRateLimit,
): preHandlerAsyncHookHandler {
  const byIp = app.createRateLimit({ max: limits.perIp, timeWindow: limits.windowMs });
  const byEmail = app.createRateLimit({
    max: limits.perEmail,
    timeWindow: limits.windowMs,
    keyGenerator: (request: FastifyRequest) =>
      normalizeEmail((request.body as { email: string }).email),
  });

  return async (request, reply) => {
    for (const limiter of [byIp, byEmail]) {
      const result = await limiter(request);
      if (!result.isAllowed && result.isExceeded) {
        reply.header('retry-after', result.ttlInSeconds);
        throw new TooManyAttemptsError();
      }
    }
  };
}

export function registerGlobalHooks(app: FastifyInstance): void {
  app.decorateRequest('user', null);
  app.addHook('onRequest', csrf);
  app.addHook('onSend', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
  });
}
