import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { server } from '../../test/msw';
import { renderApp } from '../../test/render';
import { problem } from '../../test/fake-api';

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('E-mail'), email);
  await user.type(screen.getByLabelText('Senha'), password);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('LoginPage', () => {
  test('invalid credentials show a message without saying which field was wrong', async () => {
    renderApp('/login');

    await fillAndSubmit('solicitante@gex.test', 'senha-errada');

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.');
  });

  test('TOO_MANY_REQUESTS shows the Retry-After wait time', async () => {
    server.use(
      http.post('*/api/auth/login', () =>
        problem(429, 'TOO_MANY_REQUESTS', 'Muitas tentativas.', {
          headers: { 'Retry-After': '42' },
        }),
      ),
    );
    renderApp('/login');

    await fillAndSubmit('solicitante@gex.test', 'qualquer');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Muitas tentativas de login. Tente novamente em 42 segundos.',
    );
  });

  test('empty fields are validated before calling the API', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    await user.click(await screen.findByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Informe o e-mail.')).toBeInTheDocument();
    expect(screen.getByText('Informe a senha.')).toBeInTheDocument();
  });

  test('a valid login goes to the page the user tried to open', async () => {
    const { router } = renderApp('/requests');

    await fillAndSubmit('financeiro@gex.test', 'GexFinance123!');

    expect(await screen.findByText('Fernanda Financeiro')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/requests');
  });
});
