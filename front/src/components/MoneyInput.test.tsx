import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { render } from '../test/render';
import { parseBRLToCents } from '../lib/money';
import { MoneyInput } from './MoneyInput';

function Harness() {
  const [text, setText] = useState('');
  return (
    <>
      <MoneyInput label="Valor" value={text} onChange={setText} />
      <output data-testid="cents">{String(parseBRLToCents(text))}</output>
    </>
  );
}

describe('#10 MoneyInput', () => {
  test('#10 typing 155313 shows 1.553,13 (each digit enters from the right)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Valor');

    await user.type(input, '1');
    expect(input).toHaveValue('0,01');

    await user.type(input, '55313');
    expect(input).toHaveValue('1.553,13');
    expect(screen.getByTestId('cents')).toHaveTextContent('155313');
  });

  test('#10 typed letters and separators are ignored; backspace removes the last digit', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Valor');

    await user.type(input, '1a2,3.4');
    expect(input).toHaveValue('12,34');

    await user.type(input, '{Backspace}');
    expect(input).toHaveValue('1,23');
  });

  test('#10 pasting "R$ 2.000,00" is worth 200000 cents', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Valor');

    await user.click(input);
    await user.paste('R$ 2.000,00');

    expect(input).toHaveValue('2.000,00');
    expect(screen.getByTestId('cents')).toHaveTextContent('200000');
  });

  test('#10 pasting "10" is worth R$ 10,00 (parser, not the mask)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Valor');

    await user.click(input);
    await user.paste('10');

    expect(input).toHaveValue('10,00');
    expect(screen.getByTestId('cents')).toHaveTextContent('1000');
  });

  test('#10 pasting the US format is rejected with a message, without changing the value', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Valor');

    await user.click(input);
    await user.paste('1553.13');

    expect(input).toHaveValue('');
    expect(screen.getByText(/não está no formato brasileiro/)).toBeInTheDocument();
  });
});
