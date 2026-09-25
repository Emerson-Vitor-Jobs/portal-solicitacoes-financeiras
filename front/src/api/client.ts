import createClient, { type Middleware } from 'openapi-fetch';
import { ApiError, isProblem, parseRetryAfter } from './errors';
import type { paths } from './schema';

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

function lateBoundFetch(request: Request): Promise<Response> {
  return globalThis.fetch(request);
}

export const api = createClient<paths>({
  baseUrl: globalThis.location.origin,
  credentials: 'same-origin',
  fetch: lateBoundFetch,
});
api.use(csrfMiddleware);

type UnauthenticatedListener = () => void;
let unauthenticatedListener: UnauthenticatedListener | null = null;

export function setUnauthenticatedListener(listener: UnauthenticatedListener | null): void {
  unauthenticatedListener = listener;
}

type FetchResult<T> = { data?: T; error?: unknown; response: Response };

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
