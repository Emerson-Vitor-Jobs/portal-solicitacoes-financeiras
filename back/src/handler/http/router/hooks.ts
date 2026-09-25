// Hooks das rotas. Todos rodam no onRequest, ANTES da validação do corpo e do handler: sem sessão → 401 e papel
// errado → 403 saem sem ler o corpo e sem buscar o recurso (DECISOES_FUNDACAO §5, §8).
import type {
  FastifyInstance,
  FastifyRequest,
  onRequestAsyncHookHandler,
  onRequestHookHandler,
  preHandlerAsyncHookHandler,
} from 'fastify';
import { normalizeEmail, type AuthService } from '../../../service/auth.js';
import { ForbiddenError } from '../../../service/errors.js';
import type { Role } from '../../../types/common.js';
import { TooManyAttemptsError } from '../errors.js';
import { sessionUser } from '../request_context.js';
import { CSRF_HEADER, CSRF_VALUE, SESSION_COOKIE } from '../session.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Toda requisição que muda estado exige o header customizado (§8.3). Um site atacante não consegue enviá-lo
// sem preflight CORS, e o CORS não está habilitado. Vale também para o login (login CSRF).
export const csrf: onRequestHookHandler = (request, _reply, done) => {
  if (!SAFE_METHODS.has(request.method) && request.headers[CSRF_HEADER] !== CSRF_VALUE) {
    done(new ForbiddenError('Requisição sem o header anti-CSRF.'));
    return;
  }
  done();
};

// Carrega o usuário da sessão (e o papel atual, do banco) a partir do cookie `sid`.
export function authenticate(auth: AuthService): onRequestAsyncHookHandler {
  return async (request) => {
    request.user = await auth.authenticate(request.cookies[SESSION_COOKIE]);
  };
}

// Roda depois do authenticate, na mesma fila do onRequest: o papel é checado antes de qualquer busca (§5).
export function requireRole(role: Role): onRequestHookHandler {
  return (request, _reply, done) => {
    if (sessionUser(request).role !== role) {
      done(new ForbiddenError());
      return;
    }
    done();
  };
}

export interface LoginRateLimit {
  perIp: number;
  perEmail: number;
  windowMs: number;
}

// Dois baldes no login (§14.6): por IP (muitas contas a partir de um lugar) e por e-mail normalizado (ataque
// distribuído contra uma conta). O de e-mail conta também e-mail inexistente, senão revelaria quais contas existem.
// Roda no preHandler porque o balde por e-mail precisa do corpo já validado.
// Dois `app.rateLimit()` na mesma rota não funcionam: o plugin marca a requisição na 1ª passada e pula a 2ª.
// Por isso cada balde é um limitador independente (`createRateLimit`) e a decisão fica aqui.
export function loginRateLimit(
  app: FastifyInstance,
  limits: LoginRateLimit,
): preHandlerAsyncHookHandler {
  // Sem keyGenerator: a chave padrão do plugin é o IP (com o agrupamento de IPv6 da correção 11.2.0).
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
  // Dado financeiro autenticado não fica em cache de navegador, proxy nem CDN (§5.7).
  app.addHook('onSend', async (_request, reply) => {
    reply.header('cache-control', 'no-store');
  });
}
