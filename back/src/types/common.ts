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

export const businessDateSchema = z.iso
  .date()
  .describe('Data de negócio no formato YYYY-MM-DD, sem fuso');
export const instantSchema = z.iso.datetime({ offset: true }).describe('Instante RFC 3339');

export const idParamsSchema = z.object({ id: z.string() });

export const userRefSchema = z.object({ id: z.uuid(), name: z.string() }).meta({ id: 'UserRef' });

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
