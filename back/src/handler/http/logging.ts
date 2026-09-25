import {
  LogController,
  type FastifyLoggerOptions,
  type FastifyReply,
  type FastifyRequest,
  type FastifyServerOptions,
} from 'fastify';
import './request_context.js';

export interface LogStream {
  write(line: string): void;
}

export interface SafeError {
  name: string;
  code?: string;
}

export function serializeError(err: unknown): SafeError {
  if (typeof err !== 'object' || err === null) return { name: typeof err };
  const { name, code } = err as { name?: unknown; code?: unknown };
  return {
    name: typeof name === 'string' ? name : 'Error',
    ...(typeof code === 'string' ? { code } : {}),
  };
}

class RequestLogController extends LogController {
  override incomingRequest(): void {}

  override requestCompleted(
    error: Error | null | undefined,
    request: FastifyRequest,
    reply: FastifyReply,
  ): void {
    const params = request.params as { id?: unknown } | undefined;
    const line = {
      user_id: request.user?.id ?? null,
      method: request.method,
      route: request.routeOptions.url ?? null,
      status: reply.statusCode,
      duration_ms: Math.round(reply.elapsedTime),
      ...(typeof params?.id === 'string' ? { resource_id: params.id } : {}),
    };
    if (error) reply.log.error({ ...line, err: serializeError(error) }, 'request errored');
    else reply.log.info(line, 'request completed');
  }
}

export function logControllerOptions(): Pick<FastifyServerOptions, 'logController'> {
  return { logController: new RequestLogController({ requestIdLogLabel: 'request_id' }) };
}

type ErrSerializer = NonNullable<NonNullable<FastifyLoggerOptions['serializers']>['err']>;

export function loggerOptions(level: string, stream?: LogStream): FastifyServerOptions['logger'] {
  return {
    level,
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers.authorization',
        'res.headers["set-cookie"]',
        'headers.cookie',
        'body',
        '*.body',
        'password',
        '*.password',
      ],
      censor: '[redacted]',
    },
    serializers: { err: serializeError as unknown as ErrSerializer },
    ...(stream ? { stream } : {}),
  };
}
