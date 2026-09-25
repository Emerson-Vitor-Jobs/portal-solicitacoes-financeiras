// Datas (DECISOES_FUNDACAO §6). Dois tipos, tratados de formas diferentes:
// - data de negócio (vencimento, competência, reference_date): string YYYY-MM-DD, sem fuso. Exibida
//   por manipulação de string; NUNCA vira Date (new Date('2026-09-18') é meia-noite UTC e aparece
//   como 17/09 em São Paulo);
// - instante (created_at, paid_at): RFC 3339 com offset, exibido em America/Sao_Paulo via Intl.
// O front não calcula "hoje" nem vencido: reference_date e is_overdue vêm da API (§14.2).

export const TIME_ZONE = 'America/Sao_Paulo';

const BUSINESS_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const COMPETENCE = /^(\d{4})-(\d{2})$/;
const BR_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

const MONTHS_SHORT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isValidDay(year: number, month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

// "2026-09-18" → "18/09/2026".
export function formatBusinessDate(date: string): string {
  const match = BUSINESS_DATE.exec(date);
  if (!match) return date;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

// "18/09/2026" → "2026-09-18"; data inexistente (31/02) ou fora do formato → null.
export function parseBrDate(text: string): string | null {
  const match = BR_DATE.exec(text.trim());
  if (!match) return null;
  const [, day = '', month = '', year = ''] = match;
  if (!isValidDay(Number(year), Number(month), Number(day))) return null;
  return `${year}-${month}-${day}`;
}

export function isBusinessDate(text: string): boolean {
  const match = BUSINESS_DATE.exec(text);
  if (!match) return false;
  const [, year, month, day] = match;
  return isValidDay(Number(year), Number(month), Number(day));
}

// "2026-09" → "09/2026".
export function formatCompetence(competence: string): string {
  const match = COMPETENCE.exec(competence);
  if (!match) return competence;
  return `${match[2]}/${match[1]}`;
}

// "2026-09-01" (valor do MonthPickerInput) → "2026-09" (formato do contrato).
export function competenceFromMonthValue(value: string): string {
  return value.slice(0, 7);
}

// "2026-09-18" → "set/2026" (rótulo do "pago no mês" a partir da reference_date).
export function formatMonthLabel(date: string): string {
  const match = BUSINESS_DATE.exec(date);
  const month = match ? MONTHS_SHORT[Number(match[2]) - 1] : undefined;
  if (!match || month === undefined) return date;
  return `${month}/${match[1]}`;
}

type PartName = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second';
type Parts = Record<PartName, string>;
const PART_NAMES = new Set<string>(['year', 'month', 'day', 'hour', 'minute', 'second']);

function isPartName(type: string): type is PartName {
  return PART_NAMES.has(type);
}

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function saoPauloParts(instant: Date): Parts {
  const parts: Partial<Parts> = {};
  for (const part of partsFormatter.formatToParts(instant)) {
    if (isPartName(part.type)) parts[part.type] = part.value;
  }
  const { year, month, day, hour, minute, second } = parts;
  if (!year || !month || !day || !hour || !minute || !second) {
    throw new Error('Intl did not return the date parts');
  }
  return { year, month, day, hour, minute, second };
}

// "2026-08-10T12:00:00Z" → "10/08/2026 09:00" (horário de São Paulo).
export function formatInstant(iso: string): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return iso;
  const p = saoPauloParts(instant);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

// Data e hora de agora no relógio de São Paulo (pré-preenchimento do pagamento, §6.2).
export function nowInSaoPaulo(now: Date = new Date()): { date: string; time: string } {
  const p = saoPauloParts(now);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

// Offset de São Paulo num instante, em minutos (ex.: -180), calculado pelo Intl.
function saoPauloOffsetMinutes(epochMs: number): number {
  const p = saoPauloParts(new Date(epochMs));
  const wallClockAsUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  const flooredToSecond = Math.floor(epochMs / 1000) * 1000;
  return Math.round((wallClockAsUtc - flooredToSecond) / 60_000);
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const mins = String(abs % 60).padStart(2, '0');
  return `${sign}${hours}:${mins}`;
}

// Data (YYYY-MM-DD) + hora (HH:mm) digitadas, lidas como horário de São Paulo → RFC 3339 com o offset
// de SP naquele instante (ex.: "2026-09-18T10:30:00-03:00"). O offset vem do Intl, não é fixo.
export function toSaoPauloRfc3339(date: string, time: string): string {
  const d = BUSINESS_DATE.exec(date);
  const t = TIME.exec(time);
  if (!d || !t || !isBusinessDate(date)) {
    throw new Error(`invalid date or time: ${date} ${time}`);
  }
  const wallClockAsUtc = Date.UTC(
    Number(d[1]),
    Number(d[2]) - 1,
    Number(d[3]),
    Number(t[1]),
    Number(t[2]),
  );
  // Duas passadas resolvem a virada de offset (o offset do palpite pode diferir do instante real).
  let offset = saoPauloOffsetMinutes(wallClockAsUtc);
  offset = saoPauloOffsetMinutes(wallClockAsUtc - offset * 60_000);
  return `${date}T${time}:00${formatOffset(offset)}`;
}

export function isTime(text: string): boolean {
  return TIME.test(text);
}
