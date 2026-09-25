import { http } from 'msw';
import { server } from '../test/msw';
import { problem } from '../test/fake-api';
import { api, CSRF_HEADER, CSRF_HEADER_VALUE, setUnauthenticatedListener, unwrap } from './client';
import { ApiError } from './errors';

afterEach(() => setUnauthenticatedListener(null));

describe('API client: 401 handling', () => {
  test('401 UNAUTHENTICATED on any route notifies the listener and throws ApiError', async () => {
    const listener = vi.fn();
    setUnauthenticatedListener(listener);
    server.use(http.get('*/api/dashboard/summary', () => problem(401, 'UNAUTHENTICATED', 'x')));

    const error = await unwrap(api.GET('/api/dashboard/summary')).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('UNAUTHENTICATED');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('401 INVALID_CREDENTIALS from login is not an expired session', async () => {
    const listener = vi.fn();
    setUnauthenticatedListener(listener);

    const error = await unwrap(
      api.POST('/api/auth/login', { body: { email: 'x@gex.test', password: 'errada' } }),
    ).catch((e: unknown) => e);

    expect((error as ApiError).code).toBe('INVALID_CREDENTIALS');
    expect(listener).not.toHaveBeenCalled();
  });

  test('an error without a Problem body (e.g. proxy 502) becomes an ApiError without code', async () => {
    server.use(http.get('*/api/auth/me', () => new Response('<html>502</html>', { status: 502 })));

    const error = await unwrap(api.GET('/api/auth/me')).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).code).toBeNull();
  });

  test('every POST carries the anti-CSRF header; GET does not need it', async () => {
    const seen: Record<string, string | null> = {};
    server.use(
      http.post('*/api/auth/logout', ({ request }) => {
        seen.post = request.headers.get(CSRF_HEADER);
        return new Response(null, { status: 204 });
      }),
      http.get('*/api/auth/me', ({ request }) => {
        seen.get = request.headers.get(CSRF_HEADER);
        return problem(401, 'UNAUTHENTICATED', 'x');
      }),
    );

    await unwrap(api.POST('/api/auth/logout'));
    await unwrap(api.GET('/api/auth/me')).catch((e: unknown) => e);

    expect(seen.post).toBe(CSRF_HEADER_VALUE);
    expect(seen.get).toBeNull();
  });
});
