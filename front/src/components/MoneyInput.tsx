import { TextInput, type TextInputProps } from '@mantine/core';
import { useState, type ClipboardEvent } from 'react';
import { formatCentsPlain, maskMoneyDigits, parseBRLToCents } from '../lib/money';

type Props = Omit<TextInputProps, 'value' | 'onChange' | 'onPaste'> & {
  value: string;
  onChange: (text: string) => void;
};

// Campo de valor em reais (§14.1). Duas entradas, um parser só:
// - teclado → máscara estilo banco (cada dígito entra pela direita: 1 → 0,01);
// - colar → parseBRLToCents no texto colado ("10" = R$ 10,00, "R$ 2.000,00" = R$ 2.000,00).
// O valor do campo é o texto formatado; quem usa converte com parseBRLToCents na hora de enviar.
export function MoneyInput({ value, onChange, error, ...props }: Props) {
  const [pasteError, setPasteError] = useState<string | null>(null);

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text');
    const cents = parseBRLToCents(pasted);
    if (cents === null) {
      setPasteError('O valor colado não está no formato brasileiro (ex.: 1.553,13).');
      return;
    }
    setPasteError(null);
    onChange(formatCentsPlain(cents));
  }

  return (
    <TextInput
      {...props}
      inputMode="numeric"
      autoComplete="off"
      leftSection="R$"
      placeholder="0,00"
      value={value}
      onChange={(event) => {
        setPasteError(null);
        onChange(maskMoneyDigits(event.currentTarget.value));
      }}
      onPaste={handlePaste}
      error={pasteError ?? error}
    />
  );
}
