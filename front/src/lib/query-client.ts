import { QueryClient } from '@tanstack/react-query';
import { isApiError } from '../api/errors';

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status < 500) return false;
  return failureCount < 1;
}

export function createQueryClient(options: { retry?: boolean } = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: options.retry === false ? false : shouldRetry,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}
