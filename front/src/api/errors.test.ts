import { ApiError, errorMessage, type Problem } from './errors';

describe('errorMessage', () => {
  test('a known code has its own message', () => {
    const problem: Problem = {
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      code: 'DUPLICATE_INVOICE',
      detail: 'x',
    };
    expect(errorMessage(new ApiError(409, problem))).toBe(
      'Já existe uma solicitação com este CNPJ e número de nota fiscal.',
    );
  });

  test('a code outside the contract falls back to the generic message, never empty', () => {
    const problem = {
      type: 'about:blank',
      title: 'Teapot',
      status: 418,
      code: 'CODIGO_NOVO',
      detail: 'x',
    } as unknown as Problem;
    expect(errorMessage(new ApiError(418, problem))).toBe(
      'Erro inesperado do servidor (HTTP 418). Tente novamente.',
    );
  });

  test('a non-API error (network) gets the connection message', () => {
    expect(errorMessage(new TypeError('Failed to fetch'))).toMatch(/Não foi possível falar/);
  });
});
