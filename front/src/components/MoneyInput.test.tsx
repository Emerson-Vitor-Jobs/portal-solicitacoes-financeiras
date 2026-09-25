import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { render } from '../test/render';
import { parseBRLToCents } from '../lib/money';
import { MoneyInput } from './MoneyInput';

// Mostra os centavos que o formulário enviaria, para o teste conferir o valor e não só o texto.
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
  test('#10 digitar 155313 mostra 1.553,13 (cada dígito entra pela direita)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Valor');

    await user.type(input, '1');
    expect(input).toHaveValue('0,01');

    await user.type(input, '55313');
    expect(input).toHaveValue('1.553,13');
    expect(screen.getByTestId('cents')).toHaveTextContent('155313');
  });

  test('#10 letras e separadores digitados são ignorados; apagar tira o último dígito', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Valor');

    await user.type(input, '1a2,3.4');
    expect(input).toHaveValue('12,34');

    await user.type(input, '{Backspace}');
    expect(input).toHaveValue('1,23');
  });

  test('#10 colar "R$ 2.000,00" vale 200000 centavos', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Valor');

    await user.click(input);
    await user.paste('R$ 2.000,00');

    expect(input).toHaveValue('2.000,00');
    expect(screen.getByTestId('cents')).toHaveTextContent('200000');
  });

  test('#10 colar "10" vale R$ 10,00 (parser, não a máscara)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Valor');

    await user.click(input);
    await user.paste('10');

    expect(input).toHaveValue('10,00');
    expect(screen.getByTestId('cents')).toHaveTextContent('1000');
  });

  test('#10 colar formato americano é recusado com mensagem, sem mudar o valor', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Valor');

    await user.click(input);
    await user.paste('1553.13');

    expect(input).toHaveValue('');
    expect(screen.getByText(/não está no formato brasileiro/)).toBeInTheDocument();
  });
});
