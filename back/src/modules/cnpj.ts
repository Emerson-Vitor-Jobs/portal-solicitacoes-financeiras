const FORMAT = /^[0-9A-Z]{12}[0-9]{2}$/;
const REPEATED_CHARACTER = /^(.)\1{13}$/;
const ASCII_ZERO = 48;
const FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const SECOND_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function normalizeCnpj(input: string): string {
  return input.replace(/[./\-\s]/g, '').toUpperCase();
}

function checkDigit(base: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += (base.charCodeAt(i) - ASCII_ZERO) * (weights[i] ?? 0);
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCnpj(cnpj: string): boolean {
  if (!FORMAT.test(cnpj)) return false;
  if (REPEATED_CHARACTER.test(cnpj)) return false;
  const first = checkDigit(cnpj.slice(0, 12), FIRST_WEIGHTS);
  const second = checkDigit(cnpj.slice(0, 12) + String(first), SECOND_WEIGHTS);
  return cnpj.slice(12) === `${first}${second}`;
}
