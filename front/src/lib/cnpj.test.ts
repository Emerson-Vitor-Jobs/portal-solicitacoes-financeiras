import { formatCnpj, isCnpjComplete, normalizeCnpj } from './cnpj';

describe('cnpj (forma)', () => {
  test.each([
    ['12.abc.345/01de-35', '12ABC34501DE35'],
    [' 10.000.000/0001-45 ', '10000000000145'],
    ['10000000000145', '10000000000145'],
  ])('normaliza %j → %j', (text, raw) => {
    expect(normalizeCnpj(text)).toBe(raw);
  });

  test.each([
    ['12ABC34501DE35', true],
    ['10.000.000/0001-45', true],
    ['12ABC34501DEAB', false],
    ['1000000000014', false],
    ['', false],
  ])('%j completo? %s', (text, complete) => {
    expect(isCnpjComplete(text)).toBe(complete);
  });

  test('formata numérico e alfanumérico', () => {
    expect(formatCnpj('10000000000145')).toBe('10.000.000/0001-45');
    expect(formatCnpj('12ABC34501DE35')).toBe('12.ABC.345/01DE-35');
    expect(formatCnpj('123')).toBe('123');
  });
});
