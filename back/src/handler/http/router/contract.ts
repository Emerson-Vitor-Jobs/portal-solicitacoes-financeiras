// Respostas de erro reutilizadas na documentação das rotas (todas no formato Problem, RFC 9457).
import { problemSchema } from '../../../types/common.js';

export const errors = {
  400: problemSchema.describe('Corpo ilegível (JSON quebrado)'),
  401: problemSchema.describe('Sessão ausente/expirada ou credenciais inválidas'),
  403: problemSchema.describe('Perfil sem permissão ou header anti-CSRF ausente'),
  404: problemSchema.describe('Não encontrado, de outra pessoa ou id inválido'),
  409: problemSchema.describe('Nota duplicada ou transição inválida'),
  422: problemSchema.describe('Dados inválidos (erro por campo em `errors`)'),
  429: problemSchema.describe('Muitas tentativas de login'),
} as const;

// Requisições que mudam estado exigem este header (DECISOES_FUNDACAO §8.3).
export const CSRF_NOTE = 'Exige o header `X-Requested-With: gex-web`.';
export const SESSION = [{ cookieAuth: [] }];
