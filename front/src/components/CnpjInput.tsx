import { MaskInput, type MaskInputProps } from '@mantine/core';
import { CNPJ_MASK, toUpperCaseChar } from '../lib/cnpj';

type Props = Omit<MaskInputProps, 'mask' | 'transform' | 'onChange' | 'onChangeRaw' | 'value'> & {
  onChange: (raw: string) => void;
};

export function CnpjInput({ onChange, ...props }: Props) {
  return (
    <MaskInput
      {...props}
      mask={CNPJ_MASK}
      transform={toUpperCaseChar}
      autoComplete="off"
      placeholder="00.000.000/0000-00"
      onChangeRaw={(rawValue) => onChange(rawValue)}
    />
  );
}
