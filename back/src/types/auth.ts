import { z } from 'zod';
import { businessDateSchema, roleSchema } from './common.js';

export const loginBodySchema = z.object({
  email: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(200),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const userSchema = z
  .object({ id: z.uuid(), name: z.string(), email: z.string(), role: roleSchema })
  .meta({ id: 'User' });

export const loginResponseSchema = z.object({ user: userSchema }).meta({ id: 'LoginResponse' });

// Contexto da sessão: quem está logado + o "hoje" do servidor (§14.2).
export const meResponseSchema = z
  .object({ user: userSchema, reference_date: businessDateSchema })
  .meta({ id: 'Me' });
