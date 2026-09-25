import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { server } from './test/msw';
import { sessionQueryKey } from './features/auth/api';
import { renderApp } from './test/render';
import { FINANCE_EMAIL, loginAs, problem, REQUESTER_EMAIL, state } from './test/fake-api';

describe('protected routes and session', () => {
  test('without a session, any protected route goes to /login (without saying it expired)', async () => {
    const { router } = renderApp('/requests');

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.queryByText(/sessão expirou/i)).not.toBeInTheDocument();
  });

  test('401 UNAUTHENTICATED with a loaded session goes to /login with "Sua sessão expirou"', async () => {
    loginAs(FINANCE_EMAIL);
    const { router, queryClient } = renderApp('/');
    expect(await screen.findByText('Fernanda Financeiro')).toBeInTheDocument();

    state.currentUser = null;
    await act(() => queryClient.invalidateQueries());

    expect(await screen.findByText('Sua sessão expirou. Entre novamente.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  test('with a session, shows the layout with the role menu', async () => {
    loginAs(FINANCE_EMAIL);
    renderApp('/');

    expect(await screen.findByText('Fernanda Financeiro')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Abrir menu' }));
    expect(screen.getByRole('link', { name: 'Solicitações' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nova solicitação' })).not.toBeInTheDocument();
  });

  test('a failing session refetch (5xx) with loaded data does not tear down the screen being edited', async () => {
    const user = userEvent.setup();
    loginAs(REQUESTER_EMAIL);
    const { queryClient } = renderApp('/requests/new');
    const form = within(await screen.findByRole('dialog', { name: 'Nova solicitação' }));
    const supplier = form.getByLabelText(/Fornecedor/);
    await user.type(supplier, 'Texto em edição');

    server.use(http.get('*/api/auth/me', () => problem(500, 'INTERNAL', 'x')));
    await act(() => queryClient.refetchQueries({ queryKey: sessionQueryKey }));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(queryClient.getQueryState(sessionQueryKey)?.status).toBe('error');
    expect(screen.queryByText('Não foi possível carregar a sessão')).not.toBeInTheDocument();
    expect(form.getByLabelText(/Fornecedor/)).toHaveValue('Texto em edição');
  });
});
