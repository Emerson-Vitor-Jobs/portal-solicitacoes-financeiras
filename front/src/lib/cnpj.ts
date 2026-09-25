export const CNPJ_MASK = '**.***.***/****-99';

const CNPJ_SHAPE = /^[0-9A-Z]{12}[0-9]{2}$/;

export function normalizeCnpj(text: string): string {
  return text.replace(/[.\-/\s]/g, '').toUpperCase();
}

export function isCnpjComplete(text: string): boolean {
  return CNPJ_SHAPE.test(normalizeCnpj(text));
}

export function formatCnpj(text: string): string {
  const raw = normalizeCnpj(text);
  if (!CNPJ_SHAPE.test(raw)) return text;
  return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12)}`;
}

export function toUpperCaseChar(char: string): string {
  return char.toUpperCase();
}
