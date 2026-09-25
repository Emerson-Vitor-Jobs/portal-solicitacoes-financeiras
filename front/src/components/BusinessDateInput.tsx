import { DateInput, type DateInputProps } from '@mantine/dates';
import { parseBrDate } from '../lib/date';

type Props = Omit<DateInputProps, 'value' | 'onChange' | 'valueFormat' | 'dateParser'> & {
  value: string | null;
  onChange: (value: string | null) => void;
};

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
