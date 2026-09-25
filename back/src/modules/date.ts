import type { Status } from '../types/common.js';

export const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

const BUSINESS_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isBusinessDate(value: string): boolean {
  const match = BUSINESS_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
  );
}

function parseBusinessDateParts(date: string): [number, number, number] {
  const match = BUSINESS_DATE.exec(date);
  if (!match || !isBusinessDate(date)) throw new Error(`data de negócio inválida: ${date}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function formatNormalizedDate(year: number, month: number, day: number): string {
  const utc = new Date(Date.UTC(year, month - 1, day));
  const y = String(utc.getUTCFullYear()).padStart(4, '0');
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const dayInSaoPaulo = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function businessDateOf(instant: Date): string {
  return dayInSaoPaulo.format(instant);
}

export function parseAppToday(appToday: string | undefined): string | undefined {
  if (appToday !== undefined && !isBusinessDate(appToday)) {
    throw new Error(`APP_TODAY inválida (use YYYY-MM-DD): ${appToday}`);
  }
  return appToday;
}

export function referenceDate(appToday: string | undefined, now: Date): string {
  return parseAppToday(appToday) ?? businessDateOf(now);
}

export function isOverdue(status: Status, dueDate: string, reference: string): boolean {
  return (status === 'PENDING' || status === 'APPROVED') && dueDate < reference;
}

const offsetInSaoPaulo = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  timeZoneName: 'longOffset',
});

function offsetMinutes(instant: number): number {
  const name = offsetInSaoPaulo.formatToParts(instant).find((p) => p.type === 'timeZoneName');
  const match = /^GMT(?:([+-])(\d{2}):(\d{2}))?$/.exec(name?.value ?? '');
  if (!match) throw new Error('fuso de America/Sao_Paulo indisponível no Intl');
  if (match[1] === undefined) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
}

export function startOfDaySaoPaulo(date: string): Date {
  const [year, month, day] = parseBusinessDateParts(date);
  const midnightUtc = Date.UTC(year, month - 1, day);
  const naiveStart = midnightUtc - offsetMinutes(midnightUtc) * 60_000;
  const correctedStart = midnightUtc - offsetMinutes(naiveStart) * 60_000;
  return new Date(businessDateOf(new Date(correctedStart)) === date ? correctedStart : naiveStart);
}

export function endOfDaySaoPaulo(date: string): Date {
  const [year, month, day] = parseBusinessDateParts(date);
  return startOfDaySaoPaulo(formatNormalizedDate(year, month, day + 1));
}

export function monthBoundsSaoPaulo(reference: string): { start: Date; end: Date } {
  const [year, month] = parseBusinessDateParts(reference);
  return {
    start: startOfDaySaoPaulo(formatNormalizedDate(year, month, 1)),
    end: startOfDaySaoPaulo(formatNormalizedDate(year, month + 1, 1)),
  };
}
