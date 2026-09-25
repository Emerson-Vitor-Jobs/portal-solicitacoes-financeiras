import { screen, within } from '@testing-library/react';
import { http } from 'msw';
import { server } from '../../test/msw';
import { renderApp } from '../../test/render';
import { FINANCE_EMAIL, loginAs, problem, REQUESTER_EMAIL } from '../../test/fake-api';

async function indicator(label: string) {
  return within(await screen.findByRole('region', { name: label }));
}

describe('DashboardPage', () => {
  test('FINANCE vê os números do seed (R$ 8.750,49 / 6.585,99 / 8.415,49 / 4)', async () => {
    loginAs(FINANCE_EMAIL);
    renderApp('/');

    expect((await indicator('Total pendente')).getByText('R$ 8.750,49')).toBeInTheDocument();
    expect((await indicator('Total aprovado')).getByText('R$ 6.585,99')).toBeInTheDocument();
    expect((await indicator('Pago em set/2026')).getByText('R$ 8.415,49')).toBeInTheDocument();
    expect((await indicator('Solicitações vencidas')).getByText('4')).toBeInTheDocument();
    expect(screen.getByText(/Data de referência: 18\/09\/2026/)).toBeInTheDocument();
  });

  test('REQUESTER vê só os próprios números', async () => {
    loginAs(REQUESTER_EMAIL);
    renderApp('/');

    expect((await indicator('Total pendente')).getByText('R$ 1.949,99')).toBeInTheDocument();
    expect((await indicator('Solicitações vencidas')).getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/Somente as suas solicitações/)).toBeInTheDocument();
  });

  test('erro do servidor aparece com opção de tentar de novo', async () => {
    loginAs(FINANCE_EMAIL);
    server.use(http.get('*/api/dashboard/summary', () => problem(500, 'INTERNAL', 'x')));
    renderApp('/');

    expect(await screen.findByText('Não foi possível carregar o painel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  test('401 UNAUTHENTICATED no painel leva ao login com "Sua sessão expirou"', async () => {
    loginAs(FINANCE_EMAIL);
    server.use(http.get('*/api/dashboard/summary', () => problem(401, 'UNAUTHENTICATED', 'x')));
    const { router } = renderApp('/');

    expect(await screen.findByText('Sua sessão expirou. Entre novamente.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });
});
