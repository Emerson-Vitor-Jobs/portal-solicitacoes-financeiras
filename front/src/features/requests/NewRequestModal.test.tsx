import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { http } from 'msw';
import { server } from '../../test/msw';
import { renderApp } from '../../test/render';
import { FINANCE_EMAIL, loginAs, problem, REQUESTER_EMAIL, state } from '../../test/fake-api';

function modal() {
  return within(screen.getByRole('dialog', { name: 'Nova solicitação' }));
}

function postsToRequests() {
  return state.requestLog.filter((r) => r.method === 'POST' && r.url.pathname === '/api/requests');
}

async function fillValidForm(user: UserEvent, invoice = 'NF-2026-9001') {
  await screen.findByRole('dialog', { name: 'Nova solicitação' });
  await user.type(modal().getByLabelText(/Fornecedor/), 'Aurora Serviços Digitais');
  await user.type(modal().getByLabelText(/CNPJ do fornecedor/), '12abc34501de35');
  await user.type(modal().getByLabelText(/Número da nota fiscal/), invoice);
  await user.type(modal().getByLabelText(/Valor/), '155313');

  await user.click(modal().getByLabelText(/Competência/));
  await user.click(await screen.findByRole('button', { name: 'set' }));

  await user.type(modal().getByLabelText(/Vencimento/), '30/09/2026');

  await user.click(modal().getByLabelText(/Categoria/, { selector: 'input' }));
  await user.click(await screen.findByRole('option', { name: 'Serviços' }));
}

describe('#10 NewRequestModal', () => {
  test('#10 sends the contract body: cents, unmasked CNPJ, string dates', async () => {
    const user = userEvent.setup();
    loginAs(REQUESTER_EMAIL);
    const { router } = renderApp('/requests/new');

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Enviar solicitação' }));

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/requests\/2000/));
    expect(postsToRequests().map((r) => r.body)).toEqual([
      {
        supplier_name: 'Aurora Serviços Digitais',
        supplier_cnpj: '12ABC34501DE35',
        invoice_number: 'NF-2026-9001',
        amount_cents: 155313,
        competence: '2026-09',
        due_date: '2026-09-30',
        category: 'SERVIÇOS',
        description: null,
      },
    ]);
    expect(await screen.findByText('Solicitação criada.')).toBeInTheDocument();
  });

  test('#10 double-submit guard: two quick clicks = 1 POST, button locked while sending', async () => {
    const user = userEvent.setup();
    loginAs(REQUESTER_EMAIL);
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post('*/api/requests', async () => {
        await gate;
        return undefined;
      }),
    );
    renderApp('/requests/new');
    await fillValidForm(user);
    const button = screen.getByRole('button', { name: 'Enviar solicitação' });

    await user.dblClick(button);
    await user.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute('data-loading', 'true');
    release();
    expect(await screen.findByText('Solicitação criada.')).toBeInTheDocument();
    expect(postsToRequests()).toHaveLength(1);
  });

  test('#10 a 409 DUPLICATE_INVOICE shows the message on the invoice field', async () => {
    const user = userEvent.setup();
    loginAs(REQUESTER_EMAIL);
    renderApp('/requests/new');

    await fillValidForm(user, 'NF-2026-1001');
    await user.clear(modal().getByLabelText(/CNPJ do fornecedor/));
    await user.type(modal().getByLabelText(/CNPJ do fornecedor/), '10000000000145');
    await user.click(screen.getByRole('button', { name: 'Enviar solicitação' }));

    const invoice = modal().getByLabelText(/Número da nota fiscal/);
    await waitFor(() => expect(invoice).toHaveAttribute('aria-invalid', 'true'));
    expect(
      screen.getByText('Já existe uma solicitação com este CNPJ e número de nota fiscal.'),
    ).toBeInTheDocument();
    expect(invoice).toHaveAccessibleDescription(
      /Já existe uma solicitação com este CNPJ e número de nota fiscal\./,
    );
    expect(screen.getByRole('button', { name: 'Enviar solicitação' })).toBeEnabled();
  });

  test('422 with errors[] points each error to the right field (amount_cents → Valor)', async () => {
    const user = userEvent.setup();
    loginAs(REQUESTER_EMAIL);
    server.use(
      http.post('*/api/requests', () =>
        problem(422, 'VALIDATION_FAILED', 'Dados inválidos.', {
          errors: [
            { field: 'supplier_cnpj', message: 'CNPJ com dígito verificador inválido.' },
            { field: 'amount_cents', message: 'Valor acima do permitido.' },
          ],
        }),
      ),
    );
    renderApp('/requests/new');

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Enviar solicitação' }));

    expect(await screen.findByText('CNPJ com dígito verificador inválido.')).toBeInTheDocument();
    expect(modal().getByLabelText(/Valor/)).toHaveAccessibleDescription(
      /Valor acima do permitido\./,
    );
  });

  test('validates the shape before sending (nothing reaches the API)', async () => {
    const user = userEvent.setup();
    loginAs(REQUESTER_EMAIL);
    renderApp('/requests/new');

    await screen.findByRole('dialog', { name: 'Nova solicitação' });
    await user.type(modal().getByLabelText(/CNPJ do fornecedor/), '12ABC');
    await user.click(screen.getByRole('button', { name: 'Enviar solicitação' }));

    expect(await screen.findByText('Informe o fornecedor.')).toBeInTheDocument();
    expect(screen.getByText('Informe o CNPJ completo.')).toBeInTheDocument();
    expect(screen.getByText('Informe um valor maior que zero.')).toBeInTheDocument();
    expect(screen.getByText('Informe a competência.')).toBeInTheDocument();
    expect(screen.getByText('Informe o vencimento.')).toBeInTheDocument();
    expect(screen.getByText('Escolha a categoria.')).toBeInTheDocument();
    expect(postsToRequests()).toHaveLength(0);
  });

  test('FINANCE does not see the form', async () => {
    loginAs(FINANCE_EMAIL);
    renderApp('/requests/new');

    expect(await screen.findByText('Acesso restrito')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar solicitação' })).not.toBeInTheDocument();
  });
});
