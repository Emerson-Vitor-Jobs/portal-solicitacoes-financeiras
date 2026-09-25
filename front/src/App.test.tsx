import { act, screen } from '@testing-library/react';
import { renderApp } from '../test/render';
import { FINANCE_EMAIL, loginAs, state } from './test/fake-api';

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
    expect(screen.getByRole('link', { name: 'Solicitações' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nova solicitação' })).not.toBeInTheDocument();
  });
});
