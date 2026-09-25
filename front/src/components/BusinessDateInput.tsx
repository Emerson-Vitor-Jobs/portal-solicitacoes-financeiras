import { DateInput, type DateInputProps } from '@mantine/dates';
import { parseBrDate } from '../lib/date';

type Props = Omit<DateInputProps, 'value' | 'onChange' | 'valueFormat' | 'dateParser'> & {
  value: string | null;
  onChange: (value: string | null) => void;
};

// Data de negócio: o valor é sempre a string YYYY-MM-DD (o DateInput do Mantine 9 trabalha com
// string). A digitação em DD/MM/AAAA é lida por parseBrDate, sem passar por Date.
export function BusinessDateInput({ value, onChange, ...props }: Props) {
  return (
    <DateInput
      {...props}
      value={value}
      onChange={onChange}
      valueFormat="DD/MM/YYYY"
      dateParser={parseBrDate}
      placeholder="dd/mm/aaaa"
    />
  );
}
