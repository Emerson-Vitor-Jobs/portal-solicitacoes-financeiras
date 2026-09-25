// CNPJ numérico e alfanumérico (DECISOES_FUNDACAO §11): 12 posições em 0–9/A–Z + 2 DVs numéricos.
// O front só valida a FORMA (máscara completa). O DV é regra de domínio e é conferido no back (422).

// Máscara AA.AAA.AAA/AAAA-00 no formato do MaskInput do Mantine: `*` = letra ou dígito, `9` = dígito.
export const CNPJ_MASK = '**.***.***/****-99';

const CNPJ_SHAPE = /^[0-9A-Z]{12}[0-9]{2}$/;

// Remove pontuação e espaços e passa para maiúscula (a mesma normalização do back).
export function normalizeCnpj(text: string): string {
  return text.replace(/[.\-/\s]/g, '').toUpperCase();
}

export function isCnpjComplete(text: string): boolean {
  return CNPJ_SHAPE.test(normalizeCnpj(text));
}

// "12ABC34501DE35" → "12.ABC.345/01DE-35". Um valor fora da forma é devolvido como veio.
export function formatCnpj(text: string): string {
  const raw = normalizeCnpj(text);
  if (!CNPJ_SHAPE.test(raw)) return text;
  return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12)}`;
}

export function toUpperCaseChar(char: string): string {
  return char.toUpperCase();
}
