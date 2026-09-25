import type { components } from './schema';

export type Problem = components['schemas']['Problem'];
export type ProblemCode = Problem['code'];
export type FieldError = NonNullable<Problem['errors']>[number];

export class ApiError extends Error {
  readonly status: number;
  readonly problem: Problem | null;
  readonly retryAfterSeconds: number | null;

  constructor(status: number, problem: Problem | null, retryAfterSeconds: number | null = null) {
    super(problem?.detail ?? `Request failed (HTTP ${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  get code(): ProblemCode | null {
    return this.problem?.code ?? null;
  }

  get fieldErrors(): FieldError[] {
    return this.problem?.errors ?? [];
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function hasCode(error: unknown, code: ProblemCode): boolean {
  return isApiError(error) && error.code === code;
}

export function isProblem(body: unknown): body is Problem {
  if (typeof body !== 'object' || body === null) return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.code === 'string' &&
    typeof candidate.status === 'number' &&
    typeof candidate.detail === 'string'
  );
}

export function parseRetryAfter(header: string | null): number | null {
  if (header === null || !/^\d+$/.test(header.trim())) return null;
  return Number(header.trim());
}

export function errorMessage(error: unknown): string {
  if (!isApiError(error)) {
    return 'Não foi possível falar com o servidor. Verifique a conexão e tente novamente.';
  }
  const code = error.code;
  if (code === null) {
    return `Erro inesperado do servidor (HTTP ${error.status}). Tente novamente.`;
  }
  switch (code) {
    case 'VALIDATION_FAILED':
      return 'Há dados inválidos. Revise os campos e tente novamente.';
    case 'INVALID_CREDENTIALS':
      return 'E-mail ou senha inválidos.';
    case 'UNAUTHENTICATED':
      return 'Sua sessão expirou. Entre novamente.';
    case 'FORBIDDEN':
      return 'Você não tem permissão para esta ação.';
    case 'NOT_FOUND':
      return 'Registro não encontrado.';
    case 'DUPLICATE_INVOICE':
      return 'Já existe uma solicitação com este CNPJ e número de nota fiscal.';
    case 'INVALID_TRANSITION':
      return 'A solicitação mudou de status e esta ação não é mais permitida.';
    case 'TOO_MANY_REQUESTS':
      return tooManyRequestsMessage(error.retryAfterSeconds);
    case 'INTERNAL':
      return 'Erro interno do servidor. Tente novamente em instantes.';
  }
  return `Erro inesperado do servidor (HTTP ${error.status}). Tente novamente.`;
}

export function tooManyRequestsMessage(retryAfterSeconds: number | null): string {
  if (retryAfterSeconds === null) {
    return 'Muitas tentativas de login. Tente novamente em instantes.';
  }
  if (retryAfterSeconds < 60) {
    return `Muitas tentativas de login. Tente novamente em ${retryAfterSeconds} segundo${retryAfterSeconds === 1 ? '' : 's'}.`;
  }
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `Muitas tentativas de login. Tente novamente em ${minutes} minuto${minutes === 1 ? '' : 's'}.`;
}
