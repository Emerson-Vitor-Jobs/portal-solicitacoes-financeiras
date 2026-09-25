import { MONEY_PARSE_EXAMPLES } from '../test/fixtures';
import { formatCents, maskMoneyDigits, parseBRLToCents } from './money';

describe('#1 parseBRLToCents', () => {
  test.each(Object.entries(MONEY_PARSE_EXAMPLES))(
    '#1 exemplo oficial do expected_results.json: %j → %i',
    (text, cents) => {
      expect(parseBRLToCents(text)).toBe(cents);
    },
  );

  // Tabela da DECISOES_FUNDACAO §14.1.
  test.each([
    ['1,5', 150],
    ['1,55', 155],
    ['1.553', 155300],
    ['R$1.553,13', 155313],
    ['  R$   10,5  ', 1050],
    ['1.000.000,00', 100000000],
    ['0,10', 10],
  ])('#1 aceita %j → %i', (text, cents) => {
    expect(parseBRLToCents(text)).toBe(cents);
  });

  test.each([
    '1553.13',
    '1,553.13',
    '1,555',
    '1.55',
    'abc',
    '0',
    '0,00',
    '-1',
    '',
    'R$',
    '1.5533,00',
    '1..553',
    ',50',
    '10,',
    'US$ 10',
    '99999999999999999,99',
  ])('#1 rejeita %j', (text) => {
    expect(parseBRLToCents(text)).toBeNull();
  });
});

describe('formatCents', () => {
  test.each([
    [155313, 'R$ 1.553,13'],
    [1, 'R$ 0,01'],
    [1000, 'R$ 10,00'],
    [200000, 'R$ 2.000,00'],
    [875049, 'R$ 8.750,49'],
    [100000000, 'R$ 1.000.000,00'],
    [0, 'R$ 0,00'],
  ])('%i → %j', (cents, text) => {
    expect(formatCents(cents)).toBe(text);
  });

  test('formatar e reler devolve o mesmo valor', () => {
    for (const cents of [1, 99, 100, 155313, 658599, 123456789]) {
      expect(parseBRLToCents(formatCents(cents))).toBe(cents);
    }
  });
});

describe('maskMoneyDigits (máscara estilo banco)', () => {
  test.each([
    ['', ''],
    ['1', '0,01'],
    ['15', '0,15'],
    ['155313', '1.553,13'],
    ['0,015', '0,15'],
    ['1.553,135', '15.531,35'],
    ['0,0', ''],
  ])('%j → %j', (text, masked) => {
    expect(maskMoneyDigits(text)).toBe(masked);
  });
});
