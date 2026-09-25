import { MaskInput, type MaskInputProps } from '@mantine/core';
import { CNPJ_MASK, toUpperCaseChar } from '../lib/cnpj';

type Props = Omit<MaskInputProps, 'mask' | 'transform' | 'onChange' | 'onChangeRaw' | 'value'> & {
  // Recebe o CNPJ sem máscara, em maiúscula (ex.: "12ABC34501DE35").
  onChange: (raw: string) => void;
};

// CNPJ alfanumérico com máscara AA.AAA.AAA/AAAA-00 (§11): aceita letras nas 12 primeiras posições,
// só dígitos nos DVs, e converte para maiúscula enquanto digita ou cola. Usa o MaskInput do
// próprio Mantine 9 (cursor, colar, apagar sobre a pontuação e desfazer já resolvidos).
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
