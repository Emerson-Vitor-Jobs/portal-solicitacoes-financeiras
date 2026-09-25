import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { server } from '../../../test/msw';
import { renderApp } from '../../../test/render';
import { FINANCE_EMAIL, loginAs, problem, REQUESTER_EMAIL, state } from '../../test/fake-api';
import type { RequestStatus } from './api';

// Solicitações da Ana no seed, uma por status (visíveis para ela e para o financeiro).
const REQUEST_BY_STATUS: Record<RequestStatus, string> = {
  PENDING: '20000000-0000-4000-8000-000000000001',
  APPROVED: '20000000-0000-4000-8000-000000000007',
  REJECTED: '20000000-0000-4000-8000-000000000015',
  PAID: '20000000-0000-4000-8000-000000000011',
};

const ALL_ACTIONS = ['Aprovar', 'Rejeitar', 'Marcar como pago'];

function postsTo(suffix: string) {
  return state.requestLog.filter((r) => r.method === 'POST' && r.url.pathname.endsWith(suffix));
}

describe('#10 RequestDetailPage: ações por papel e status', () => {
  const matrix: [string, RequestStatus, string[]][] = [
    [FINANCE_EMAIL, 'PENDING', ['Aprovar', 'Rejeitar']],
    [FINANCE_EMAIL, 'APPROVED', ['Marcar como pago']],
    [FINANCE_EMAIL, 'REJECTED', []],
    [FINANCE_EMAIL, 'PAID', []],
    [REQUESTER_EMAIL, 'PENDING', []],
    [REQUESTER_EMAIL, 'APPROVED', []],
    [REQUESTER_EMAIL, 'REJECTED', []],
    [REQUESTER_EMAIL, 'PAID', []],
  ];

  test.each(matrix)('#10 %s + %s mostra só %j', async (email, status, expected) => {
    loginAs(email);
    renderApp(`/requests/${REQUEST_BY_STATUS[status]}`);
    await screen.findByRole('heading', { name: 'Histórico' });

    for (const label of ALL_ACTIONS) {
      const button = screen.queryByRole('button', { name: label });
      if (expected.includes(label)) expect(button).toBeInTheDocument();
      else expect(button).not.toBeInTheDocument();
    }
  });
});

describe('RequestDetailPage', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('mostra todos os dados e o histórico em ordem', async () => {
    loginAs(FINANCE_EMAIL);
    renderApp(`/requests/${REQUEST_BY_STATUS.PAID}`);

    expect(await screen.findByRole('heading', { name: 'Histórico' })).toBeInTheDocument();
    expect(screen.getByText('R$ 2.550,50')).toBeInTheDocument();
    expect(screen.getByText('18/09/2026')).toBeInTheDocument();
    expect(screen.getByText('PAG-2026-0011')).toBeInTheDocument();
    expect(screen.getByText('Pago em').nextElementSibling).toHaveTextContent('18/09/2026 14:00');
    expect(screen.getByText('Criada como Pendente')).toBeInTheDocument();
    expect(screen.getByText('Pendente → Aprovada')).toBeInTheDocument();
    expect(screen.getByText('Aprovada → Paga')).toBeInTheDocument();
  });

  test('solicitação inexistente ou de outra pessoa (404) mostra "não encontrada"', async () => {
    loginAs(REQUESTER_EMAIL);
    // A 000002 é do Bruno: para a Ana, o back responde 404.
    renderApp('/requests/20000000-0000-4000-8000-000000000002');

    expect(await screen.findByText('Solicitação não encontrada')).toBeInTheDocument();
  });

  test('refetch do detalhe que falha não desmonta o modal aberto nem perde o texto', async () => {
    const user = userEvent.setup();
    loginAs(FINANCE_EMAIL);
    const { queryClient } = renderApp(`/requests/${REQUEST_BY_STATUS.PENDING}`);
    await user.click(await screen.findByRole('button', { name: 'Rejeitar' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Rejeitar solicitação' }));
    await user.type(dialog.getByLabelText(/Motivo da rejeição/), 'Motivo em edição');

    server.use(http.get('*/api/requests/:id', () => problem(500, 'INTERNAL', 'x')));
    await act(() => queryClient.refetchQueries({ queryKey: ['requests', 'detail'] }));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(screen.getByText('Não foi possível atualizar a solicitação')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Rejeitar solicitação' })).toBeInTheDocument();
    expect(dialog.getByLabelText(/Motivo da rejeição/)).toHaveValue('Motivo em edição');
  });

  test('rejeitar exige motivo e envia o motivo; o histórico mostra a transição', async () => {
    const user = userEvent.setup();
    loginAs(FINANCE_EMAIL);
    renderApp(`/requests/${REQUEST_BY_STATUS.PENDING}`);

    await user.click(await screen.findByRole('button', { name: 'Rejeitar' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Rejeitar solicitação' }));
    await user.click(dialog.getByRole('button', { name: 'Confirmar rejeição' }));
    expect(await dialog.findByText('Informe o motivo da rejeição.')).toBeInTheDocument();
    expect(postsTo('/decision')).toHaveLength(0);

    await user.type(dialog.getByLabelText(/Motivo da rejeição/), 'Nota sem assinatura');
    await user.click(dialog.getByRole('button', { name: 'Confirmar rejeição' }));

    expect(await screen.findByText('Pendente → Rejeitada')).toBeInTheDocument();
    expect(postsTo('/decision').map((r) => r.body)).toEqual([
      { decision: 'REJECT', reason: 'Nota sem assinatura' },
    ]);
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument();
    expect(screen.getByText('Motivo: Nota sem assinatura')).toBeInTheDocument();
  });

  test('aprovar: dois cliques rápidos = 1 POST', async () => {
    const user = userEvent.setup();
    loginAs(FINANCE_EMAIL);
    renderApp(`/requests/${REQUEST_BY_STATUS.PENDING}`);

    await user.click(await screen.findByRole('button', { name: 'Aprovar' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Aprovar solicitação' }));
    await user.dblClick(dialog.getByRole('button', { name: 'Confirmar aprovação' }));

    expect(await screen.findByText('Pendente → Aprovada')).toBeInTheDocument();
    expect(postsTo('/decision')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Marcar como pago' })).toBeInTheDocument();
  });

  test('409 INVALID_TRANSITION avisa e recarrega o detalhe', async () => {
    const user = userEvent.setup();
    loginAs(FINANCE_EMAIL);
    renderApp(`/requests/${REQUEST_BY_STATUS.PENDING}`);
    await user.click(await screen.findByRole('button', { name: 'Aprovar' }));

    // Outra pessoa rejeitou antes: o estado no "servidor" já mudou.
    const request = state.requests.find((r) => r.id === REQUEST_BY_STATUS.PENDING);
    if (!request) throw new Error('fixture ausente');
    request.status = 'REJECTED';
    request.rejection_reason = 'Rejeitada por outra pessoa';

    const dialog = within(await screen.findByRole('dialog', { name: 'Aprovar solicitação' }));
    await user.click(dialog.getByRole('button', { name: 'Confirmar aprovação' }));

    expect(await screen.findByText('A solicitação mudou de status')).toBeInTheDocument();
    expect(await screen.findByText('Rejeitada por outra pessoa')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument();
  });

  test('marcar como pago: pré-preenche com o agora real em SP e envia RFC 3339 com offset', async () => {
    // Só o Date é falso (o relógio real é 25/09/2026 15:30 em SP; a reference_date é 18/09).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-25T18:30:00Z'));
    const user = userEvent.setup();
    loginAs(FINANCE_EMAIL);
    renderApp(`/requests/${REQUEST_BY_STATUS.APPROVED}`);

    await user.click(await screen.findByRole('button', { name: 'Marcar como pago' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Registrar pagamento' }));
    expect(dialog.getByLabelText(/Data do pagamento/)).toHaveValue('25/09/2026');
    expect(dialog.getByLabelText(/Hora/)).toHaveValue('15:30');
    await user.click(dialog.getByRole('button', { name: 'Confirmar pagamento' }));
    expect(await dialog.findByText('Informe a referência do pagamento.')).toBeInTheDocument();

    await user.type(dialog.getByLabelText(/Referência do pagamento/), 'PAG-2026-0099');
    await user.click(dialog.getByRole('button', { name: 'Confirmar pagamento' }));

    expect(await screen.findByText('Aprovada → Paga')).toBeInTheDocument();
    expect(postsTo('/mark-paid').map((r) => r.body)).toEqual([
      { paid_at: '2026-09-25T15:30:00-03:00', payment_reference: 'PAG-2026-0099' },
    ]);
  });

  test('a data do pagamento não passa do hoje real em SP (o campo recusa amanhã)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-25T18:30:00Z'));
    const user = userEvent.setup();
    loginAs(FINANCE_EMAIL);
    renderApp(`/requests/${REQUEST_BY_STATUS.APPROVED}`);

    await user.click(await screen.findByRole('button', { name: 'Marcar como pago' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Registrar pagamento' }));
    const date = dialog.getByLabelText(/Data do pagamento/);
    await user.clear(date);
    await user.type(date, '26/09/2026');
    await user.tab();

    expect(date).toHaveValue('25/09/2026');
    await user.type(dialog.getByLabelText(/Referência do pagamento/), 'PAG-1');
    await user.click(dialog.getByRole('button', { name: 'Confirmar pagamento' }));
    expect(await screen.findByText('Aprovada → Paga')).toBeInTheDocument();
    expect(postsTo('/mark-paid').map((r) => r.body)).toEqual([
      { paid_at: '2026-09-25T15:30:00-03:00', payment_reference: 'PAG-1' },
    ]);
  });

  test('422 do pagamento (ex.: antes da aprovação) aparece no campo da data', async () => {
    const user = userEvent.setup();
    loginAs(FINANCE_EMAIL);
    server.use(
      http.post('*/api/requests/:id/mark-paid', () =>
        problem(422, 'VALIDATION_FAILED', 'Dados inválidos.', {
          errors: [{ field: 'paid_at', message: 'O pagamento não pode ser anterior à aprovação.' }],
        }),
      ),
    );
    renderApp(`/requests/${REQUEST_BY_STATUS.APPROVED}`);

    await user.click(await screen.findByRole('button', { name: 'Marcar como pago' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Registrar pagamento' }));
    await user.type(dialog.getByLabelText(/Referência do pagamento/), 'PAG-1');
    await user.click(dialog.getByRole('button', { name: 'Confirmar pagamento' }));

    await waitFor(() =>
      expect(dialog.getByLabelText(/Data do pagamento/)).toHaveAccessibleDescription(
        'O pagamento não pode ser anterior à aprovação.',
      ),
    );
  });
});
