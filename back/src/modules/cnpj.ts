// CNPJ numérico e alfanumérico (IN RFB nº 2.229/2024), DECISOES_FUNDACAO §11.
// DV = módulo 11 sobre (código ASCII − 48) de cada posição: para dígitos é o próprio dígito, então o CNPJ
// numérico é um caso particular do alfanumérico, e não um segundo algoritmo.

const FORMAT = /^[0-9A-Z]{12}[0-9]{2}$/;
const FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const SECOND_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

// Tira a máscara (`.`, `/`, `-`, espaços) e passa para maiúscula. Não valida: isso é do isValidCnpj.
export function normalizeCnpj(input: string): string {
  return input.replace(/[./\-\s]/g, '').toUpperCase();
}

function checkDigit(base: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += (base.charCodeAt(i) - 48) * (weights[i] ?? 0);
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

// Espera o CNPJ já normalizado (14 posições, sem máscara).
export function isValidCnpj(cnpj: string): boolean {
  if (!FORMAT.test(cnpj)) return false;
  // "00000000000000", "11111111111111"… passam no módulo 11, mas não são CNPJ.
  if (/^(.)\1{13}$/.test(cnpj)) return false;
  const first = checkDigit(cnpj.slice(0, 12), FIRST_WEIGHTS);
  const second = checkDigit(cnpj.slice(0, 12) + String(first), SECOND_WEIGHTS);
  return cnpj.slice(12) === `${first}${second}`;
}
