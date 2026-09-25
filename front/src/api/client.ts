import createClient, { type Middleware } from 'openapi-fetch';
import { ApiError, isProblem, parseRetryAfter } from './errors';
import type { paths } from './schema';

// Header anti-CSRF exigido em todo POST (DECISOES_FUNDACAO §8.3).
export const CSRF_HEADER = 'X-Requested-With';
export const CSRF_HEADER_VALUE = 'gex-web';

const csrfMiddleware: Middleware = {
  onRequest({ request }) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      request.headers.set(CSRF_HEADER, CSRF_HEADER_VALUE);
    }
    return request;
  },
};

// Mesma origem (o nginx faz o proxy de /api). A sessão vai só no cookie HttpOnly: nenhum token em
// memória ou em localStorage (§8). O `fetch` é resolvido a cada chamada para respeitar quem o
// substitua depois da importação (o MSW nos testes).
export const api = createClient<paths>({
  baseUrl: globalThis.location.origin,
  credentials: 'same-origin',
  fetch: (request) => globalThis.fetch(request),
});
api.use(csrfMiddleware);

// Quem reage a um 401 UNAUTHENTICATED (a sessão caiu no servidor). Registrado pelo layout raiz,
// que conhece o roteador.
type UnauthenticatedListener = () => void;
let unauthenticatedListener: UnauthenticatedListener | null = null;

export function setUnauthenticatedListener(listener: UnauthenticatedListener | null): void {
  unauthenticatedListener = listener;
}

// Forma do retorno do openapi-fetch (sucesso com `data`, falha com `error`).
type FetchResult<T> = { data?: T; error?: unknown; response: Response };

// Ponto único de saída das chamadas: devolve o `data` ou lança ApiError. Um 401 UNAUTHENTICATED em
// qualquer rota avisa o listener antes de lançar.
export async function unwrap<T>(call: Promise<FetchResult<T>>): Promise<T> {
  const result = await call;
  if (result.error === undefined && result.response.ok) {
    return result.data as T;
  }
  const problem = isProblem(result.error) ? result.error : null;
  const error = new ApiError(
    result.response.status,
    problem,
    parseRetryAfter(result.response.headers.get('Retry-After')),
  );
  if (error.status === 401 && error.code === 'UNAUTHENTICATED') {
    unauthenticatedListener?.();
  }
  throw error;
}
