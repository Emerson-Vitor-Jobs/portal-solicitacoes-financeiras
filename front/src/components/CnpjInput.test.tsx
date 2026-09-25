import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '../test/render';
import { CnpjInput } from './CnpjInput';

describe('CnpjInput', () => {
  test('accepts letters, uppercases them and applies the mask', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CnpjInput label="CNPJ" onChange={onChange} />);
    const input = screen.getByLabelText('CNPJ');

    await user.type(input, '12abc34501de35');

    expect(input).toHaveValue('12.ABC.345/01DE-35');
    expect(onChange).toHaveBeenLastCalledWith('12ABC34501DE35');
  });

  test('the two check digits accept only numbers', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CnpjInput label="CNPJ" onChange={onChange} />);

    await user.type(screen.getByLabelText('CNPJ'), '12ABC34501DEXY35');

    expect(onChange).toHaveBeenLastCalledWith('12ABC34501DE35');
  });

  test('pasting with or without the mask gives the same value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CnpjInput label="CNPJ" onChange={onChange} />);

    await user.click(screen.getByLabelText('CNPJ'));
    await user.paste('10.000.000/0001-45');

    expect(onChange).toHaveBeenLastCalledWith('10000000000145');
  });
});
