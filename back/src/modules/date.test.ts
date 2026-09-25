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

describe('#12 date edges', () => {
  test('due today is not overdue; yesterday is', () => {
    expect(isOverdue('PENDING', '2026-09-18', '2026-09-18')).toBe(false);
    expect(isOverdue('PENDING', '2026-09-17', '2026-09-18')).toBe(true);
    expect(isOverdue('APPROVED', '2026-09-17', '2026-09-18')).toBe(true);
    expect(isOverdue('APPROVED', '2026-09-19', '2026-09-18')).toBe(false);
  });

  test('PAID and REJECTED are never overdue', () => {
    for (const status of ['PAID', 'REJECTED'] as const) {
      expect(isOverdue(status, '2020-01-01', '2026-09-18')).toBe(false);
    }
    expect(STATUSES).toEqual(['PENDING', 'APPROVED', 'REJECTED', 'PAID']);
  });

  test('a defined APP_TODAY is the reference', () => {
    expect(referenceDate('2026-09-18', new Date('2027-01-01T12:00:00Z'))).toBe('2026-09-18');
  });

  test('an invalid APP_TODAY fails loudly', () => {
    expect(() => referenceDate('2026-02-30', new Date())).toThrow('APP_TODAY');
    expect(() => referenceDate('18/09/2026', new Date())).toThrow('APP_TODAY');
  });

  test('without APP_TODAY, the date is São Paulo time, not UTC', () => {
    expect(referenceDate(undefined, new Date('2026-09-19T01:30:00Z'))).toBe('2026-09-18');
    expect(referenceDate(undefined, new Date('2026-09-19T03:00:00Z'))).toBe('2026-09-19');
  });

  test('reference month in SP: [09-01 00:00 -03, 10-01 00:00 -03)', () => {
    const { start, end } = monthBoundsSaoPaulo('2026-09-18');
    expect(start.toISOString()).toBe('2026-09-01T03:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-01T03:00:00.000Z');
    const lastMinuteOfAugust = new Date('2026-08-31T23:59:00-03:00');
    expect(lastMinuteOfAugust < start).toBe(true);
  });

  test('year rollover at the month limit', () => {
    const { start, end } = monthBoundsSaoPaulo('2026-12-31');
    expect(start.toISOString()).toBe('2026-12-01T03:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-01T03:00:00.000Z');
  });

  test('start and exclusive end of the day in SP', () => {
    expect(startOfDaySaoPaulo('2026-09-18').toISOString()).toBe('2026-09-18T03:00:00.000Z');
    expect(endOfDaySaoPaulo('2026-09-18').toISOString()).toBe('2026-09-19T03:00:00.000Z');
    expect(endOfDaySaoPaulo('2026-02-28').toISOString()).toBe('2026-03-01T03:00:00.000Z');
  });

  test('DST start (midnight that never existed): the day starts at 01:00 -02:00', () => {
    const start = startOfDaySaoPaulo('2018-11-04');
    expect(businessDateOf(start)).toBe('2018-11-04');
    expect(start.toISOString()).toBe('2018-11-04T03:00:00.000Z');
    expect(businessDateOf(new Date(start.getTime() - 1))).toBe('2018-11-03');
    expect(endOfDaySaoPaulo('2018-11-03').getTime()).toBe(start.getTime());
  });

  test('DST end (23:00 of 02-16 repeats): 02-17 starts at 00:00 -03:00', () => {
    const start = startOfDaySaoPaulo('2019-02-17');
    expect(start.toISOString()).toBe('2019-02-17T03:00:00.000Z');
    expect(businessDateOf(start)).toBe('2019-02-17');
    expect(businessDateOf(new Date(start.getTime() - 1))).toBe('2019-02-16');
  });

  test('a business date must exist in the calendar', () => {
    expect(isBusinessDate('2028-02-29')).toBe(true);
    expect(isBusinessDate('2026-02-29')).toBe(false);
    expect(isBusinessDate('2026-9-18')).toBe(false);
  });
});
