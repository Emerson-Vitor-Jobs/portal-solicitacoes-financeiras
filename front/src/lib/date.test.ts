import {
  competenceFromMonthValue,
  formatBusinessDate,
  formatCompetence,
  formatInstant,
  formatMonthLabel,
  nowInSaoPaulo,
  parseBrDate,
  toSaoPauloRfc3339,
} from './date';

// Roda com o relógio do processo em fusos diferentes: o resultado não pode depender dele.
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('datas de negócio (string, sem fuso)', () => {
  test.each(['UTC', 'America/Sao_Paulo', 'Pacific/Honolulu', 'Asia/Tokyo'])(
    '2026-09-18 aparece como 18/09/2026 com o processo em %s (nunca 17/09)',
    (tz) => {
      vi.stubEnv('TZ', tz);
      expect(formatBusinessDate('2026-09-18')).toBe('18/09/2026');
    },
  );

  test('competência e rótulo do mês', () => {
    expect(formatCompetence('2026-09')).toBe('09/2026');
    expect(competenceFromMonthValue('2026-09-01')).toBe('2026-09');
    expect(formatMonthLabel('2026-09-18')).toBe('set/2026');
    expect(formatMonthLabel('2026-01-01')).toBe('jan/2026');
  });

  test.each([
    ['18/09/2026', '2026-09-18'],
    ['29/02/2028', '2028-02-29'],
    ['29/02/2026', null],
    ['31/04/2026', null],
    ['2026-09-18', null],
    ['1/9/2026', null],
  ])('parseBrDate(%j) → %j', (text, expected) => {
    expect(parseBrDate(text)).toBe(expected);
  });
});

describe('instantes em America/Sao_Paulo', () => {
  test.each(['UTC', 'Asia/Tokyo'])('exibe no horário de SP com o processo em %s', (tz) => {
    vi.stubEnv('TZ', tz);
    expect(formatInstant('2026-08-10T09:00:00-03:00')).toBe('10/08/2026 09:00');
    expect(formatInstant('2026-09-01T02:30:00Z')).toBe('31/08/2026 23:30');
  });

  test('agora em SP (data e hora do relógio de SP)', () => {
    expect(nowInSaoPaulo(new Date('2026-09-19T01:15:00Z'))).toEqual({
      date: '2026-09-18',
      time: '22:15',
    });
  });

  test('data + hora de SP → RFC 3339 com o offset de SP calculado pelo Intl', () => {
    vi.stubEnv('TZ', 'Asia/Tokyo');
    expect(toSaoPauloRfc3339('2026-09-18', '10:30')).toBe('2026-09-18T10:30:00-03:00');
    // Em dezembro de 2018 São Paulo ainda tinha horário de verão (-02:00): o offset não é fixo.
    expect(toSaoPauloRfc3339('2018-12-01', '10:00')).toBe('2018-12-01T10:00:00-02:00');
  });

  test('data ou hora inválida lança erro', () => {
    expect(() => toSaoPauloRfc3339('2026-02-30', '10:00')).toThrow();
    expect(() => toSaoPauloRfc3339('2026-09-18', '25:00')).toThrow();
  });
});
