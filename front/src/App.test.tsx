import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { server } from '../test/msw';
import { sessionQueryKey } from './features/auth/api';
import { renderApp } from '../test/render';
import { FINANCE_EMAIL, loginAs, problem, REQUESTER_EMAIL, state } from './test/fake-api';

describe('rotas protegidas e sessão', () => {
  test('sem sessão, qualquer rota protegida leva ao /login (sem dizer que expirou)', async () => {
    const { router } = renderApp('/requests');

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.queryByText(/sessão expirou/i)).not.toBeInTheDocument();
  });

  test('401 UNAUTHENTICATED com a sessão carregada leva ao /login com "Sua sessão expirou"', async () => {
    loginAs(FINANCE_EMAIL);
    const { router, queryClient } = renderApp('/');
    expect(await screen.findByText('Fernanda Financeiro')).toBeInTheDocument();

    // A sessão cai no servidor; a próxima chamada qualquer recebe 401 UNAUTHENTICATED.
    state.currentUser = null;
    await act(() => queryClient.invalidateQueries());

    expect(await screen.findByText('Sua sessão expirou. Entre novamente.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  test('com sessão, mostra o layout com o menu do papel', async () => {
    loginAs(FINANCE_EMAIL);
    renderApp('/');

    expect(await screen.findByText('Fernanda Financeiro')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    expect(screen.getByRole('link', { name: 'Solicitações' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nova solicitação' })).not.toBeInTheDocument();
  });

  test('refetch da sessão que falha (5xx) com dados carregados não derruba a tela em edição', async () => {
    const user = userEvent.setup();
    loginAs(REQUESTER_EMAIL);
    const { queryClient } = renderApp('/requests/new');
    const form = within(await screen.findByRole('dialog', { name: 'Nova solicitação' }));
    const supplier = form.getByLabelText(/Fornecedor/);
    await user.type(supplier, 'Texto em edição');

    server.use(http.get('*/api/auth/me', () => problem(500, 'INTERNAL', 'x')));
    await act(() => queryClient.refetchQueries({ queryKey: sessionQueryKey }));
    // O TanStack Query notifica os componentes num tick seguinte; espera a tela reagir.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(queryClient.getQueryState(sessionQueryKey)?.status).toBe('error');
    expect(screen.queryByText('Não foi possível carregar a sessão')).not.toBeInTheDocument();
    expect(form.getByLabelText(/Fornecedor/)).toHaveValue('Texto em edição');
  });
});
