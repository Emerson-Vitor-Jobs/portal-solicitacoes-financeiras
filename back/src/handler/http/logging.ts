// Política de log (DECISOES_FUNDACAO §14.5). A linha de requisição carrega só campos de identificação; corpo,
// query string, cookie, senha, SQL e dados financeiros nunca entram. Erro vira { name, code }: o erro do pg traz
// `detail` com os valores reais (ex.: o 23505 mostra CNPJ + nota), então ele é reduzido antes de chegar ao log.
import {
  LogController,
  type FastifyLoggerOptions,
  type FastifyReply,
  type FastifyRequest,
  type FastifyServerOptions,
} from 'fastify';
import './request_context.js';

// Destino do log (os testes passam um coletor para inspecionar as linhas).
export interface LogStream {
  write(line: string): void;
}

export interface SafeError {
  name: string;
  code?: string;
}

// Reduz qualquer erro (ou objeto com cara de erro) a nome + código. Mensagem, detail, where e stack ficam de fora.
export function serializeError(err: unknown): SafeError {
  if (typeof err !== 'object' || err === null) return { name: typeof err };
  const { name, code } = err as { name?: unknown; code?: unknown };
  return {
    name: typeof name === 'string' ? name : 'Error',
    ...(typeof code === 'string' ? { code } : {}),
  };
}

// Substitui as linhas padrão do Fastify ("incoming request" com URL e headers) por uma linha só, no fim.
class RequestLogController extends LogController {
  override incomingRequest(): void {
    // Nada na entrada: a linha única sai no requestCompleted, já com status e duração.
  }

  override requestCompleted(
    error: Error | null | undefined,
    request: FastifyRequest,
    reply: FastifyReply,
  ): void {
    const params = request.params as { id?: unknown } | undefined;
    const line = {
      user_id: request.user?.id ?? null,
      method: request.method,
      // O padrão da rota (`/api/requests/:id`), nunca a URL com query string.
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

// O tipo do Fastify descreve a saída do serializador PADRÃO (type, message, stack). O nosso devolve menos, de
// propósito, então a assinatura é afirmada aqui, num ponto só.
type ErrSerializer = NonNullable<NonNullable<FastifyLoggerOptions['serializers']>['err']>;

export function loggerOptions(level: string, stream?: LogStream): FastifyServerOptions['logger'] {
  return {
    level,
    // Segunda camada: mesmo que alguém logue o objeto errado, estes caminhos saem censurados.
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
      censor: '[omitido]',
    },
    serializers: { err: serializeError as unknown as ErrSerializer },
    ...(stream ? { stream } : {}),
  };
}
