const BRAZILIAN_AMOUNT_PATTERN = /^(?:R\$)?\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;

const MAX_MONEY_DIGITS = 15;

export function parseBRLToCents(text: string): number | null {
  const match = BRAZILIAN_AMOUNT_PATTERN.exec(text.trim());
  if (!match) return null;
  const integerDigits = (match[1] ?? '').replaceAll('.', '');
  const decimalDigits = (match[2] ?? '').padEnd(2, '0');
  const cents = Number(integerDigits + decimalDigits);
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return cents;
}

export function formatCentsPlain(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`invalid cents value: ${cents}`);
  }
  const sign = cents < 0 ? '-' : '';
  const digits = String(Math.abs(cents)).padStart(3, '0');
  const integerPart = digits.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${integerPart},${digits.slice(-2)}`;
}

export function formatCents(cents: number): string {
  return `R$ ${formatCentsPlain(cents)}`;
}

export function maskMoneyDigits(text: string): string {
  const digits = text.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_MONEY_DIGITS);
  if (digits === '') return '';
  return formatCentsPlain(Number(digits));
}
