import { describe, expect, test } from 'vitest';
import { readDataFile } from '../../test/support/data.js';
import { isValidCnpj, normalizeCnpj } from './cnpj.js';

describe('#11 CNPJ: normalization and check digits', () => {
  test.each([
    ['unmasked', '11222333000181', true],
    ['masked', '11.222.333/0001-81', true],
    ['with spaces', ' 11 222 333 0001 81 ', true],
    ['official alphanumeric example', '12ABC34501DE35', true],
    ['alphanumeric masked and lowercase', '12.abc.345/01de-35', true],
    ['wrong check digit (last)', '11222333000182', false],
    ['wrong check digit (first)', '11222333000191', false],
    ['wrong alphanumeric check digit', '12ABC34501DE36', false],
    ['all zeros', '00000000000000', false],
    ['all equal', '11111111111111', false],
    ['all equal masked', '99.999.999/9999-99', false],
    ['too short', '1122233300018', false],
    ['too long', '112223330001810', false],
    ['letter in check digit', '12ABC34501DE3A', false],
    ['character outside the alphabet', '12ABC34501D#35', false],
    ['empty', '', false],
  ])('%s: %s → %s', (_label, input, expected) => {
    expect(isValidCnpj(normalizeCnpj(input))).toBe(expected);
  });

  test('normalizes to 14 uppercase positions', () => {
    expect(normalizeCnpj('12.abc.345/01de-35')).toBe('12ABC34501DE35');
  });

  test('all official seed CNPJs are valid', async () => {
    const requests = await readDataFile<{ supplier_cnpj: string }[]>('seed_requests.json');
    expect(requests).toHaveLength(16);
    for (const r of requests) expect(isValidCnpj(r.supplier_cnpj), r.supplier_cnpj).toBe(true);
  });
});
