import { z } from 'zod';
import { isCnpjComplete, normalizeCnpj } from '../../lib/cnpj';
import { competenceFromMonthValue, isBusinessDate } from '../../lib/date';
import { CATEGORY_LABELS, enumValues } from '../../lib/labels';
import { parseBRLToCents } from '../../lib/money';
import type { CreateRequestBody } from './api';

// Validação de FORMA no front (obrigatório, tamanho, máscara completa). Regra de domínio (DV do
// CNPJ, duplicidade) é do back e volta como 422/409 no campo certo.
// A saída do schema é o corpo do POST /requests do contrato (tipo gerado).
const categories = enumValues(CATEGORY_LABELS);

export const newRequestSchema = z.object({
  supplier_name: z
    .string()
    .trim()
    .min(1, 'Informe o fornecedor.')
    .max(200, 'Use no máximo 200 caracteres.'),
  supplier_cnpj: z
    .string()
    .refine(isCnpjComplete, 'Informe o CNPJ completo.')
    .transform(normalizeCnpj),
  invoice_number: z
    .string()
    .trim()
    .min(1, 'Informe o número da nota fiscal.')
    .max(50, 'Use no máximo 50 caracteres.'),
  amount: z.string().transform((text, ctx) => {
    const cents = parseBRLToCents(text);
    if (cents === null) {
      ctx.addIssue({ code: 'custom', message: 'Informe um valor maior que zero.' });
      return z.NEVER;
    }
    return cents;
  }),
  competence: z
    .string()
    .nullable()
    .transform((value, ctx) => {
      if (value === null || value === '') {
        ctx.addIssue({ code: 'custom', message: 'Informe a competência.' });
        return z.NEVER;
      }
      return competenceFromMonthValue(value);
    }),
  due_date: z
    .string()
    .nullable()
    .transform((value, ctx) => {
      if (value === null || !isBusinessDate(value)) {
        ctx.addIssue({ code: 'custom', message: 'Informe o vencimento.' });
        return z.NEVER;
      }
      return value;
    }),
  category: z
    .enum(categories)
    .nullable()
    .transform((value, ctx) => {
      if (value === null) {
        ctx.addIssue({ code: 'custom', message: 'Escolha a categoria.' });
        return z.NEVER;
      }
      return value;
    }),
  description: z
    .string()
    .trim()
    .max(1000, 'Use no máximo 1000 caracteres.')
    .transform((value) => (value === '' ? null : value)),
});

export type NewRequestInput = z.input<typeof newRequestSchema>;
export type NewRequestOutput = z.output<typeof newRequestSchema>;
export type NewRequestField = keyof NewRequestInput;

export const emptyNewRequest: NewRequestInput = {
  supplier_name: '',
  supplier_cnpj: '',
  invoice_number: '',
  amount: '',
  competence: null,
  due_date: null,
  category: null,
  description: '',
};

export function toCreateBody(values: NewRequestOutput): CreateRequestBody {
  const { amount, ...rest } = values;
  return { ...rest, amount_cents: amount };
}

// Campo do contrato (errors[].field do 422) → campo do formulário.
export function formFieldFor(apiField: string): NewRequestField | null {
  if (apiField === 'amount_cents') return 'amount';
  return apiField in emptyNewRequest ? (apiField as NewRequestField) : null;
}
