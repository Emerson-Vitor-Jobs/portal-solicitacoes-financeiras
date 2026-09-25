export const TIME_ZONE = 'America/Sao_Paulo';

const BUSINESS_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const COMPETENCE_PATTERN = /^(\d{4})-(\d{2})$/;
const BR_DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

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

export function formatBusinessDate(date: string): string {
  const match = BUSINESS_DATE_PATTERN.exec(date);
  if (!match) return date;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function parseBrDate(text: string): string | null {
  const match = BR_DATE_PATTERN.exec(text.trim());
  if (!match) return null;
  const [, day = '', month = '', year = ''] = match;
  if (!isValidDay(Number(year), Number(month), Number(day))) return null;
  return `${year}-${month}-${day}`;
}

export function isBusinessDate(text: string): boolean {
  const match = BUSINESS_DATE_PATTERN.exec(text);
  if (!match) return false;
  const [, year, month, day] = match;
  return isValidDay(Number(year), Number(month), Number(day));
}

export function formatCompetence(competence: string): string {
  const match = COMPETENCE_PATTERN.exec(competence);
  if (!match) return competence;
  return `${match[2]}/${match[1]}`;
}

export function competenceFromMonthValue(value: string): string {
  return value.slice(0, 7);
}

export function formatMonthLabel(date: string): string {
  const match = BUSINESS_DATE_PATTERN.exec(date);
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

export function formatInstant(iso: string): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return iso;
  const clock = saoPauloParts(instant);
  return `${clock.day}/${clock.month}/${clock.year} ${clock.hour}:${clock.minute}`;
}

export function nowInSaoPaulo(now: Date = new Date()): { date: string; time: string } {
  const clock = saoPauloParts(now);
  return {
    date: `${clock.year}-${clock.month}-${clock.day}`,
    time: `${clock.hour}:${clock.minute}`,
  };
}

function saoPauloOffsetMinutes(epochMs: number): number {
  const clock = saoPauloParts(new Date(epochMs));
  const wallClockAsUtc = Date.UTC(
    Number(clock.year),
    Number(clock.month) - 1,
    Number(clock.day),
    Number(clock.hour),
    Number(clock.minute),
    Number(clock.second),
  );
  const flooredToSecond = Math.floor(epochMs / 1000) * 1000;
  return Math.round((wallClockAsUtc - flooredToSecond) / 60_000);
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const absoluteMinutes = Math.abs(minutes);
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, '0');
  const remainingMinutes = String(absoluteMinutes % 60).padStart(2, '0');
  return `${sign}${hours}:${remainingMinutes}`;
}

function resolveSaoPauloOffsetMinutes(wallClockAsUtc: number): number {
  const guessedOffset = saoPauloOffsetMinutes(wallClockAsUtc);
  return saoPauloOffsetMinutes(wallClockAsUtc - guessedOffset * 60_000);
}

export function toSaoPauloRfc3339(date: string, time: string): string {
  const dateMatch = BUSINESS_DATE_PATTERN.exec(date);
  const timeMatch = TIME_PATTERN.exec(time);
  const year = Number(dateMatch?.[1]);
  const month = Number(dateMatch?.[2]);
  const day = Number(dateMatch?.[3]);
  if (!timeMatch || !isValidDay(year, month, day)) {
    throw new Error(`invalid date or time: ${date} ${time}`);
  }
  const wallClockAsUtc = Date.UTC(year, month - 1, day, Number(timeMatch[1]), Number(timeMatch[2]));
  const offset = resolveSaoPauloOffsetMinutes(wallClockAsUtc);
  return `${date}T${time}:00${formatOffset(offset)}`;
}

export function isTime(text: string): boolean {
  return TIME_PATTERN.test(text);
}
