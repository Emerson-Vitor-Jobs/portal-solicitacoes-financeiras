// Tipos e schemas compartilhados do contrato. Campos em snake_case: é o formato da borda (DECISOES_FUNDACAO §3).
import { z } from 'zod';

export const STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'PAID'] as const;
export type Status = (typeof STATUSES)[number];
export const statusSchema = z.enum(STATUSES).meta({ id: 'RequestStatus' });

export const CATEGORIES = ['INFRAESTRUTURA', 'MARKETING', 'SERVIÇOS', 'SOFTWARE'] as const;
export type Category = (typeof CATEGORIES)[number];
export const categorySchema = z.enum(CATEGORIES).meta({ id: 'Category' });

export const ROLES = ['REQUESTER', 'FINANCE'] as const;
export type Role = (typeof ROLES)[number];
export const roleSchema = z.enum(ROLES).meta({ id: 'Role' });

// Dia do calendário, sem fuso (DECISOES_FUNDACAO §6.0). Nunca vira Date.
export const businessDateSchema = z.iso
  .date()
  .describe('Data de negócio no formato YYYY-MM-DD, sem fuso');
// Instante (RFC 3339). Na resposta sai em UTC; na entrada o offset é obrigatório (§6.2).
export const instantSchema = z.iso.datetime({ offset: true }).describe('Instante RFC 3339');

// id na URL: string livre de propósito. Um valor que não é UUID responde 404, não 422 (§5.8).
export const idParamsSchema = z.object({ id: z.string() });

export const userRefSchema = z.object({ id: z.uuid(), name: z.string() }).meta({ id: 'UserRef' });

// Problem Details (RFC 9457) com as extensões `code` e `errors` (§4a).
export const PROBLEM_CODES = [
  'VALIDATION_FAILED',
  'INVALID_CREDENTIALS',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'DUPLICATE_INVOICE',
  'INVALID_TRANSITION',
  'TOO_MANY_REQUESTS',
  'INTERNAL',
  // Só enquanto uma rota do contrato ainda não foi implementada.
  'NOT_IMPLEMENTED',
] as const;
export type ProblemCode = (typeof PROBLEM_CODES)[number];

export const problemSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    code: z.enum(PROBLEM_CODES),
    errors: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  })
  .meta({ id: 'Problem' });
export type Problem = z.infer<typeof problemSchema>;
