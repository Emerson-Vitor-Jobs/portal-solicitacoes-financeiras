import { describe, expect, test } from 'vitest';
import { readDataFile } from '../../test/support/data.js';
import { isValidCnpj, normalizeCnpj } from './cnpj.js';

describe('#11 CNPJ: normalização e dígitos verificadores', () => {
  test.each([
    ['sem máscara', '11222333000181', true],
    ['com máscara', '11.222.333/0001-81', true],
    ['com espaços', ' 11 222 333 0001 81 ', true],
    ['alfanumérico oficial da Receita', '12ABC34501DE35', true],
    ['alfanumérico com máscara e minúsculas', '12.abc.345/01de-35', true],
    ['DV errado (último)', '11222333000182', false],
    ['DV errado (primeiro)', '11222333000191', false],
    ['DV alfanumérico errado', '12ABC34501DE36', false],
    ['todos zeros', '00000000000000', false],
    ['todos iguais', '11111111111111', false],
    ['todos iguais com máscara', '99.999.999/9999-99', false],
    ['curto', '1122233300018', false],
    ['longo', '112223330001810', false],
    ['letra no DV', '12ABC34501DE3A', false],
    ['caractere fora do alfabeto', '12ABC34501D#35', false],
    ['vazio', '', false],
  ])('%s: %s → %s', (_caso, input, expected) => {
    expect(isValidCnpj(normalizeCnpj(input))).toBe(expected);
  });

  test('normaliza para as 14 posições em maiúscula', () => {
    expect(normalizeCnpj('12.abc.345/01de-35')).toBe('12ABC34501DE35');
  });

  test('os CNPJs do seed oficial são todos válidos', async () => {
    const requests = await readDataFile<{ supplier_cnpj: string }[]>('seed_requests.json');
    expect(requests).toHaveLength(16);
    for (const r of requests) expect(isValidCnpj(r.supplier_cnpj), r.supplier_cnpj).toBe(true);
  });
});
