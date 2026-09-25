// Único ponto que traduz erro → resposta HTTP, no formato RFC 9457 (DECISOES_FUNDACAO §4a e tabela da §5).
// Erro não reconhecido vira 500 genérico: a mensagem interna nunca chega ao cliente.
import type { FastifyError, FastifyInstance, FastifyReply } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import {
  DomainError,
  DuplicateInvoiceError,
  ForbiddenError,
  InvalidCredentialsError,
  InvalidTransitionError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
  type FieldError,
} from '../../service/errors.js';
import type { Problem, ProblemCode } from '../../types/common.js';

const TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
};

export function problem(
  status: number,
  code: ProblemCode,
  detail: string,
  errors?: FieldError[],
): Problem {
  return {
    type: 'about:blank',
    title: TITLES[status] ?? 'Error',
    status,
    detail,
    code,
    ...(errors ? { errors } : {}),
  };
}

// O corpo vai serializado à mão: o Content-Type é application/problem+json e não passa pelo serializador da rota.
export function sendProblem(reply: FastifyReply, body: Problem): FastifyReply {
  return reply.code(body.status).type('application/problem+json').send(JSON.stringify(body));
}

export class NotImplementedError extends Error {
  override readonly name = 'NotImplementedError';
}

function fromDomain(err: DomainError): Problem {
  if (err instanceof ValidationError)
    return problem(422, 'VALIDATION_FAILED', 'Dados inválidos.', err.errors);
  if (err instanceof InvalidCredentialsError)
    return problem(401, 'INVALID_CREDENTIALS', err.message);
  if (err instanceof UnauthenticatedError) return problem(401, 'UNAUTHENTICATED', err.message);
  if (err instanceof ForbiddenError) return problem(403, 'FORBIDDEN', err.message);
  if (err instanceof NotFoundError) return problem(404, 'NOT_FOUND', err.message);
  if (err instanceof DuplicateInvoiceError) return problem(409, 'DUPLICATE_INVOICE', err.message);
  if (err instanceof InvalidTransitionError) return problem(409, 'INVALID_TRANSITION', err.message);
  return problem(500, 'INTERNAL', 'Erro interno.');
}

// Caminho do Zod ("/supplier_name", "/items/0/name") → nome do campo ("supplier_name", "items.0.name").
function fieldOf(instancePath: string, fallback: string): string {
  const path = instancePath.replace(/^\//, '').replaceAll('/', '.');
  return path === '' ? fallback : path;
}

export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError, request, reply) => {
    // Corpo/query/params legíveis mas fora do schema → 422 com o erro por campo.
    if (hasZodFastifySchemaValidationErrors(err)) {
      const errors = err.validation.map((v) => ({
        field: fieldOf(v.instancePath, err.validationContext ?? 'body'),
        message: v.message ?? 'valor inválido',
      }));
      return sendProblem(reply, problem(422, 'VALIDATION_FAILED', 'Dados inválidos.', errors));
    }
    if (err instanceof DomainError) return sendProblem(reply, fromDomain(err));
    if (err instanceof NotImplementedError) {
      return sendProblem(reply, problem(501, 'NOT_IMPLEMENTED', 'Rota ainda não implementada.'));
    }
    // JSON quebrado ou corpo vazio: nem dá pra ler → 400 (§5.1).
    if (
      err.code === 'FST_ERR_CTP_INVALID_JSON_BODY' ||
      err.code === 'FST_ERR_CTP_EMPTY_JSON_BODY'
    ) {
      return sendProblem(reply, problem(400, 'VALIDATION_FAILED', 'Corpo da requisição ilegível.'));
    }
    if (err.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
      return sendProblem(reply, problem(415, 'VALIDATION_FAILED', 'Envie application/json.'));
    }
    if (err.statusCode === 429) {
      return sendProblem(reply, problem(429, 'TOO_MANY_REQUESTS', err.message));
    }
    // Inesperado: loga só nome e código (a mensagem de um erro do pg pode trazer dados, §14.5).
    request.log.error({ err: { name: err.name, code: err.code } }, 'erro não tratado');
    return sendProblem(reply, problem(500, 'INTERNAL', 'Erro interno.'));
  });

  app.setNotFoundHandler((_request, reply) =>
    sendProblem(reply, problem(404, 'NOT_FOUND', 'Recurso não encontrado.')),
  );
}
