// Dinheiro no front (DECISOES_FUNDACAO §14.1). Sempre inteiro em centavos; nenhuma conta com float.
// A conversão texto ↔ centavos é feita por manipulação de string.

// Gramática exclusivamente brasileira:
//   R$ opcional · espaços opcionais · parte inteira com dígitos simples (1553) ou milhar agrupado por
//   ponto em grupos de 3 (1.553) · parte decimal opcional com vírgula + 1 ou 2 dígitos.
// O formato americano (1553.13, 1,553.13) não é aceito, e por isso "1.553" não é ambíguo (= 1553,00).
const BRL_PATTERN = /^(?:R\$)?\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;

// Maior quantidade de dígitos que a máscara aceita: 15 dígitos (até R$ 9.999.999.999.999,99) cabem
// com folga em Number.MAX_SAFE_INTEGER, o teto do contrato.
export const MAX_MONEY_DIGITS = 15;

// Converte o texto em reais para centavos. Devolve `null` se o texto não segue a gramática ou se o
// valor não é maior que zero.
export function parseBRLToCents(text: string): number | null {
  const match = BRL_PATTERN.exec(text.trim());
  if (!match) return null;
  const integerDigits = (match[1] ?? '').replaceAll('.', '');
  const decimalDigits = (match[2] ?? '').padEnd(2, '0');
  const cents = Number(integerDigits + decimalDigits);
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return cents;
}

// 155313 → "1.553,13" (sem o símbolo; é o texto que aparece no campo).
export function formatCentsPlain(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`invalid cents value: ${cents}`);
  }
  const sign = cents < 0 ? '-' : '';
  const digits = String(Math.abs(cents)).padStart(3, '0');
  const integerPart = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${integerPart},${digits.slice(-2)}`;
}

// 155313 → "R$ 1.553,13".
export function formatCents(cents: number): string {
  return `R$ ${formatCentsPlain(cents)}`;
}

// Motor da máscara estilo banco: cada dígito entra pela direita. Ignora tudo que não é dígito e os
// zeros à esquerda. "1" → "0,01", "155313" → "1.553,13", "" → "".
export function maskMoneyDigits(text: string): string {
  const digits = text.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_MONEY_DIGITS);
  if (digits === '') return '';
  return formatCentsPlain(Number(digits));
}
