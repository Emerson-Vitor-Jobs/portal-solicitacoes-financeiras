import { describe, expect, test } from 'vitest';
import { STATUSES } from '../types/common.js';
import {
  businessDateOf,
  endOfDaySaoPaulo,
  isBusinessDate,
  isOverdue,
  monthBoundsSaoPaulo,
  referenceDate,
  startOfDaySaoPaulo,
} from './date.js';

describe('#12 bordas de data', () => {
  test('vence hoje não está vencida; ontem está', () => {
    expect(isOverdue('PENDING', '2026-09-18', '2026-09-18')).toBe(false);
    expect(isOverdue('PENDING', '2026-09-17', '2026-09-18')).toBe(true);
    expect(isOverdue('APPROVED', '2026-09-17', '2026-09-18')).toBe(true);
    expect(isOverdue('APPROVED', '2026-09-19', '2026-09-18')).toBe(false);
  });

  test('PAID e REJECTED nunca estão vencidas', () => {
    for (const status of ['PAID', 'REJECTED'] as const) {
      expect(isOverdue(status, '2020-01-01', '2026-09-18')).toBe(false);
    }
    // Garante que a lista de status não cresceu sem esta regra ser revista.
    expect(STATUSES).toEqual(['PENDING', 'APPROVED', 'REJECTED', 'PAID']);
  });

  test('APP_TODAY definida é a referência', () => {
    expect(referenceDate('2026-09-18', new Date('2027-01-01T12:00:00Z'))).toBe('2026-09-18');
  });

  test('APP_TODAY inválida falha alto', () => {
    expect(() => referenceDate('2026-02-30', new Date())).toThrow('APP_TODAY');
    expect(() => referenceDate('18/09/2026', new Date())).toThrow('APP_TODAY');
  });

  test('sem APP_TODAY, a data é a de São Paulo, não a de UTC', () => {
    // 01:30 UTC do dia 19 ainda é 22:30 do dia 18 em SP.
    expect(referenceDate(undefined, new Date('2026-09-19T01:30:00Z'))).toBe('2026-09-18');
    expect(referenceDate(undefined, new Date('2026-09-19T03:00:00Z'))).toBe('2026-09-19');
  });

  test('mês da referência em SP: [01/09 00:00 -03, 01/10 00:00 -03)', () => {
    const { start, end } = monthBoundsSaoPaulo('2026-09-18');
    expect(start.toISOString()).toBe('2026-09-01T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-01T03:00:00.000Z');
    // Pagamento às 23:59 de 31/08 em SP fica fora do mês de setembro.
    const lastMinuteOfAugust = new Date('2026-08-31T23:59:00-03:00');
    expect(lastMinuteOfAugust < start).toBe(true);
  });

  test('virada de ano no limite do mês', () => {
    const { start, end } = monthBoundsSaoPaulo('2026-12-31');
    expect(start.toISOString()).toBe('2026-12-01T03:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-01T03:00:00.000Z');
  });

  test('início e fim exclusivo do dia em SP', () => {
    expect(startOfDaySaoPaulo('2026-09-18').toISOString()).toBe('2026-09-18T03:00:00.000Z');
    expect(endOfDaySaoPaulo('2026-09-18').toISOString()).toBe('2026-09-19T03:00:00.000Z');
    expect(endOfDaySaoPaulo('2026-02-28').toISOString()).toBe('2026-03-01T03:00:00.000Z');
  });

  test('início do horário de verão (meia-noite que não existiu): o dia começa às 01:00 -02:00', () => {
    const start = startOfDaySaoPaulo('2018-11-04');
    expect(businessDateOf(start)).toBe('2018-11-04');
    expect(start.toISOString()).toBe('2018-11-04T03:00:00.000Z');
    // O instante anterior ainda é o dia 03.
    expect(businessDateOf(new Date(start.getTime() - 1))).toBe('2018-11-03');
    expect(endOfDaySaoPaulo('2018-11-03').getTime()).toBe(start.getTime());
  });

  test('fim do horário de verão (meia-noite repetida): começa na primeira 00:00, ainda em -02:00', () => {
    // Em 2019-02-17 o relógio voltou de 00:00 (-02) para 23:00 do dia 16 (-03).
    const start = startOfDaySaoPaulo('2019-02-17');
    expect(businessDateOf(start)).toBe('2019-02-17');
    expect(businessDateOf(new Date(start.getTime() - 1))).toBe('2019-02-16');
  });

  test('data de negócio precisa existir no calendário', () => {
    expect(isBusinessDate('2028-02-29')).toBe(true);
    expect(isBusinessDate('2026-02-29')).toBe(false);
    expect(isBusinessDate('2026-9-18')).toBe(false);
  });
});
