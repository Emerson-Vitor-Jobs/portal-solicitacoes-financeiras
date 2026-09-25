import { QueryClient } from '@tanstack/react-query';
import { isApiError } from '../api/errors';

// Erro 4xx é resposta definitiva do servidor (sessão, permissão, validação): repetir não muda nada.
// Só falha de rede e 5xx ganham uma nova tentativa.
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
