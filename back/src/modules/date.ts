// Regras de calendário (DECISOES_FUNDACAO §6.0, §14.2). Data de negócio é sempre a string YYYY-MM-DD:
// nunca vira `Date` (que carrega fuso e desloca o dia). Instante é `Date`.
import type { Status } from '../types/common.js';

export const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

const BUSINESS_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// A data precisa existir no calendário (rejeita 2026-02-30), não só casar com o formato.
export function isBusinessDate(value: string): boolean {
  const match = BUSINESS_DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
  );
}

function parts(date: string): [number, number, number] {
  const match = BUSINESS_DATE.exec(date);
  if (!match || !isBusinessDate(date)) throw new Error(`data de negócio inválida: ${date}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function format(year: number, month: number, day: number): string {
  // Date.UTC normaliza o estouro (dia 32 → dia 1 do mês seguinte, mês 13 → janeiro).
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

// O dia do calendário de SP em que cai o instante (en-CA formata como YYYY-MM-DD).
export function businessDateOf(instant: Date): string {
  return dayInSaoPaulo.format(instant);
}

// A data de referência ("hoje"): APP_TODAY quando definida; senão, a data atual em America/Sao_Paulo (não UTC).
export function referenceDate(appToday: string | undefined, now: Date): string {
  if (appToday !== undefined) {
    if (!isBusinessDate(appToday)) throw new Error(`APP_TODAY inválida: ${appToday}`);
    return appToday;
  }
  return businessDateOf(now);
}

// Vencida = PENDING ou APPROVED com vencimento ANTERIOR à referência. Vence hoje ainda não está vencida.
// A comparação de strings YYYY-MM-DD é a mesma ordem do calendário.
export function isOverdue(status: Status, dueDate: string, reference: string): boolean {
  return (status === 'PENDING' || status === 'APPROVED') && dueDate < reference;
}

const offsetInSaoPaulo = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  timeZoneName: 'longOffset',
});

// Deslocamento de SP em minutos naquele instante (ex.: -180). Lido do Intl, sem supor que é sempre -03:00.
function offsetMinutes(instant: number): number {
  const name = offsetInSaoPaulo.formatToParts(instant).find((p) => p.type === 'timeZoneName');
  const match = /^GMT(?:([+-])(\d{2}):(\d{2}))?$/.exec(name?.value ?? '');
  if (!match) throw new Error('fuso de America/Sao_Paulo indisponível no Intl');
  if (match[1] === undefined) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
}

// Primeiro instante de `date` em SP (normalmente a meia-noite). A segunda passada corrige o caso de o deslocamento
// mudar perto da meia-noite. No início do horário de verão (ex.: 2018-11-04) a meia-noite não existiu: o relógio
// pulou de 23:59:59 para 01:00. Aí a segunda passada cai no dia anterior, e o certo é o instante da primeira
// (01:00 -02:00), que é o primeiro instante existente do dia.
export function startOfDaySaoPaulo(date: string): Date {
  const [year, month, day] = parts(date);
  const midnightUtc = Date.UTC(year, month - 1, day);
  const first = midnightUtc - offsetMinutes(midnightUtc) * 60_000;
  const second = midnightUtc - offsetMinutes(first) * 60_000;
  return new Date(businessDateOf(new Date(second)) === date ? second : first);
}

// Fim EXCLUSIVO do dia `date` em SP, ou seja, o início do dia seguinte (intervalo semiaberto, §6.0).
export function endOfDaySaoPaulo(date: string): Date {
  const [year, month, day] = parts(date);
  return startOfDaySaoPaulo(format(year, month, day + 1));
}

// Limites do mês da referência em SP: [início, fim). Uso: `paid_at >= start AND paid_at < end`.
export function monthBoundsSaoPaulo(reference: string): { start: Date; end: Date } {
  const [year, month] = parts(reference);
  return {
    start: startOfDaySaoPaulo(format(year, month, 1)),
    end: startOfDaySaoPaulo(format(year, month + 1, 1)),
  };
}
