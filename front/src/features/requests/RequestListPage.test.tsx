import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { server } from '../../../test/msw';
import { renderApp } from '../../../test/render';
import { FINANCE_EMAIL, loginAs, problem, REQUESTER_EMAIL, state } from '../../test/fake-api';
import { REQUESTS } from '../../test/fixtures';

// Parâmetros da última chamada ao GET /api/requests que o fake recebeu.
function lastListParams(): Record<string, string> {
  const calls = state.requestLog.filter(
    (r) => r.method === 'GET' && r.url.pathname === '/api/requests',
  );
  const last = calls.at(-1);
  if (!last) throw new Error('nenhuma chamada ao GET /api/requests');
  return Object.fromEntries(last.url.searchParams);
}

describe('RequestListPage', () => {
  test('mostra as colunas e o selo "Vencida" vindo do is_overdue da API', async () => {
    loginAs(FINANCE_EMAIL);
    renderApp('/requests');

    const row = (await screen.findByText('NF-2026-1001')).closest('tr');
    if (!row) throw new Error('linha não encontrada');
    const cells = within(row);
    expect(cells.getByRole('link', { name: 'Aurora Serviços Digitais' })).toBeInTheDocument();
    expect(cells.getByText('R$ 1.250,00')).toBeInTheDocument();
    expect(cells.getByText('10/09/2026')).toBeInTheDocument();
    expect(cells.getByText('Vencida')).toBeInTheDocument();
    expect(cells.getByText('Pendente')).toBeInTheDocument();
    expect(cells.getByText('Ana Solicitante')).toBeInTheDocument();
    expect(screen.getByText('16 solicitações')).toBeInTheDocument();
    expect(screen.getAllByText('Vencida')).toHaveLength(4);
  });

  test('mudar o status chama a API com o filtro e volta para a página 1', async () => {
    const user = userEvent.setup();
    loginAs(FINANCE_EMAIL);
    const { router } = renderApp('/requests?page=2&supplier=a');
    await screen.findByText(/solicitaç/);

    await user.click(screen.getByLabelText('Status', { selector: 'input' }));
    await user.click(await screen.findByRole('option', { name: 'Aprovada' }));

    await waitFor(() =>
      expect(lastListParams()).toEqual({
        status: 'APPROVED',
        supplier: 'a',
        page: '1',
        page_size: '20',
      }),
    );
    expect(router.state.location.search).toBe('?supplier=a&status=APPROVED');
    expect(await screen.findByText('4 solicitações')).toBeInTheDocument();
  });

  test('a busca por fornecedor vai para a API depois do debounce', async () => {
    const user = userEvent.setup();
    loginAs(FINANCE_EMAIL);
    const { router } = renderApp('/requests');
    await screen.findByText('16 solicitações');

    await user.type(screen.getByRole('textbox', { name: 'Fornecedor' }), 'aurora');

    await waitFor(() => expect(lastListParams().supplier).toBe('aurora'));
    // Uma chamada só depois da pausa, não uma por letra.
    const supplierCalls = state.requestLog.filter((r) => r.url.searchParams.has('supplier'));
    expect(supplierCalls).toHaveLength(1);
    expect(router.state.location.search).toBe('?supplier=aurora');
  });

  test('digitar o vencimento em dd/mm/aaaa envia YYYY-MM-DD, sem conversão de fuso', async () => {
    const user = userEvent.setup();
    loginAs(FINANCE_EMAIL);
    const { router } = renderApp('/requests');
    await screen.findByText('16 solicitações');

    await user.type(screen.getByLabelText('Vencimento de'), '18/09/2026');
    await user.tab();

    await waitFor(() => expect(lastListParams().due_from).toBe('2026-09-18'));
    expect(router.state.location.search).toBe('?due_from=2026-09-18');
  });

  test('filtros e página vindos da URL (F5, voltar) vão para a API e aparecem nos campos', async () => {
    loginAs(FINANCE_EMAIL);
    renderApp('/requests?status=PENDING&due_from=2026-09-01&due_to=2026-09-30&supplier=norte');

    expect(await screen.findByText('1 solicitação')).toBeInTheDocument();
    expect(lastListParams()).toEqual({
      status: 'PENDING',
      supplier: 'norte',
      due_from: '2026-09-01',
      due_to: '2026-09-30',
      page: '1',
      page_size: '20',
    });
    expect(screen.getByLabelText('Status', { selector: 'input' })).toHaveValue('Pendente');
    expect(screen.getByRole('textbox', { name: 'Fornecedor' })).toHaveValue('norte');
    expect(screen.getByLabelText('Vencimento de')).toHaveValue('01/09/2026');
    expect(screen.getByLabelText('Vencimento até')).toHaveValue('30/09/2026');
  });

  test('paginação usa o total_pages da API e a página vai para a URL', async () => {
    const user = userEvent.setup();
    loginAs(FINANCE_EMAIL);
    const [item] = REQUESTS;
    if (!item) throw new Error('fixture vazia');
    server.use(
      http.get('*/api/requests', ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page'));
        return Response.json({
          data: [{ ...item, supplier_name: `Fornecedor da página ${page}` }],
          page,
          page_size: 20,
          total: 45,
          total_pages: 3,
          reference_date: '2026-09-18',
        });
      }),
    );
    const { router } = renderApp('/requests');
    expect(await screen.findByText('Fornecedor da página 1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '2' }));

    expect(await screen.findByText('Fornecedor da página 2')).toBeInTheDocument();
    expect(router.state.location.search).toBe('?page=2');
  });

  test('página além da última mostra o vazio com atalho para a primeira', async () => {
    const user = userEvent.setup();
    loginAs(FINANCE_EMAIL);
    const { router } = renderApp('/requests?page=9');

    expect(await screen.findByText('Nenhuma solicitação encontrada')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ir para a primeira página' }));

    expect(await screen.findByText('16 solicitações')).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
  });

  test('estado vazio e estado de erro', async () => {
    loginAs(REQUESTER_EMAIL);
    const { router } = renderApp('/requests?supplier=inexistente');
    expect(await screen.findByText('Nenhuma solicitação encontrada')).toBeInTheDocument();

    server.use(http.get('*/api/requests', () => problem(500, 'INTERNAL', 'x')));
    await router.navigate('/requests?status=PAID');
    expect(
      await screen.findByText('Não foi possível carregar as solicitações'),
    ).toBeInTheDocument();
  });
});
