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

export class TooManyAttemptsError extends Error {
  override readonly name = 'TooManyAttemptsError';
  readonly statusCode = 429;
  constructor() {
    super('Muitas tentativas de login. Tente novamente em instantes.');
  }
}

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

export function sendProblem(reply: FastifyReply, body: Problem): FastifyReply {
  return reply.code(body.status).type('application/problem+json').send(JSON.stringify(body));
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

function fieldFromInstancePath(instancePath: string, fallback: string): string {
  const path = instancePath.replace(/^\//, '').replaceAll('/', '.');
  return path === '' ? fallback : path;
}

export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      const errors = err.validation.map((v) => ({
        field: fieldFromInstancePath(v.instancePath, err.validationContext ?? 'body'),
        message: v.message ?? 'valor inválido',
      }));
      return sendProblem(reply, problem(422, 'VALIDATION_FAILED', 'Dados inválidos.', errors));
    }
    if (err instanceof DomainError) return sendProblem(reply, fromDomain(err));
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
    request.log.error({ err }, 'erro não tratado');
    return sendProblem(reply, problem(500, 'INTERNAL', 'Erro interno.'));
  });

  app.setNotFoundHandler((_request, reply) =>
    sendProblem(reply, problem(404, 'NOT_FOUND', 'Recurso não encontrado.')),
  );
}
