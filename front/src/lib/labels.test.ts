import { CATEGORY_LABELS, enumValues, isEnumValue, STATUS_LABELS } from './labels';

test('the lists come from the generated enum keys', () => {
  expect(enumValues(STATUS_LABELS)).toEqual(['PENDING', 'APPROVED', 'REJECTED', 'PAID']);
  expect(enumValues(CATEGORY_LABELS)).toEqual([
    'INFRAESTRUTURA',
    'MARKETING',
    'SERVIÇOS',
    'SOFTWARE',
  ]);
  expect(isEnumValue(STATUS_LABELS, 'PAID')).toBe(true);
  expect(isEnumValue(STATUS_LABELS, 'toString')).toBe(false);
});
