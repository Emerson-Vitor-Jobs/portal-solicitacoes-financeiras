import { screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { http } from 'msw';
import { server } from '../../../test/msw';
import { renderApp } from '../../../test/render';
import { loginAs, problem, REQUESTER_EMAIL, state } from '../../test/fake-api';

function postsToRequests() {
  return state.requestLog.filter((r) => r.method === 'POST' && r.url.pathname === '/api/requests');
}

async function fillValidForm(user: UserEvent, invoice = 'NF-2026-9001') {
  await user.type(await screen.findByLabelText(/Fornecedor/), 'Aurora Serviços Digitais');
  await user.type(screen.getByLabelText(/CNPJ do fornecedor/), '12abc34501de35');
  await user.type(screen.getByLabelText(/Número da nota fiscal/), invoice);
  await user.type(screen.getByLabelText(/Valor/), '155313');

  await user.click(screen.getByLabelText(/Competência/));
  await user.click(await screen.findByRole('button', { name: 'set' }));

  await user.type(screen.getByLabelText(/Vencimento/), '30/09/2026');

  await user.click(screen.getByLabelText(/Categoria/, { selector: 'input' }));
  await user.click(await screen.findByRole('option', { name: 'Serviços' }));
}

describe('#10 NewRequestPage', () => {
  test('#10 envia o corpo do contrato: centavos, CNPJ sem máscara, datas em string', async () => {
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

  test('#10 anti-duplo-envio: dois cliques rápidos = 1 POST, botão travado enquanto envia', async () => {
    const user = userEvent.setup();
    loginAs(REQUESTER_EMAIL);
    // Segura a resposta do POST até o teste liberar, para ver o botão durante o envio.
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post('*/api/requests', async () => {
        await gate;
        return undefined; // segue para o handler padrão do fake
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

  test('#10 um 409 DUPLICATE_INVOICE mostra a mensagem no campo da nota', async () => {
    const user = userEvent.setup();
    loginAs(REQUESTER_EMAIL);
    renderApp('/requests/new');

    // CNPJ + nota do seed (Aurora, NF-2026-1001) já existem no fake.
    await fillValidForm(user, 'NF-2026-1001');
    await user.clear(screen.getByLabelText(/CNPJ do fornecedor/));
    await user.type(screen.getByLabelText(/CNPJ do fornecedor/), '10000000000145');
    await user.click(screen.getByRole('button', { name: 'Enviar solicitação' }));

    const invoice = screen.getByLabelText(/Número da nota fiscal/);
    await waitFor(() => expect(invoice).toHaveAttribute('aria-invalid', 'true'));
    expect(
      screen.getByText('Já existe uma solicitação com este CNPJ e número de nota fiscal.'),
    ).toBeInTheDocument();
    expect(invoice).toHaveAccessibleDescription(
      /Já existe uma solicitação com este CNPJ e número de nota fiscal\./,
    );
    // O botão volta a funcionar para corrigir e reenviar.
    expect(screen.getByRole('button', { name: 'Enviar solicitação' })).toBeEnabled();
  });

  test('422 com errors[] aponta cada erro no campo certo (amount_cents → Valor)', async () => {
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
    expect(screen.getByLabelText(/Valor/)).toHaveAccessibleDescription(
      /Valor acima do permitido\./,
    );
  });

  test('valida a forma antes de enviar (nada vai para a API)', async () => {
    const user = userEvent.setup();
    loginAs(REQUESTER_EMAIL);
    renderApp('/requests/new');

    await user.type(await screen.findByLabelText(/CNPJ do fornecedor/), '12ABC');
    await user.click(screen.getByRole('button', { name: 'Enviar solicitação' }));

    expect(await screen.findByText('Informe o fornecedor.')).toBeInTheDocument();
    expect(screen.getByText('Informe o CNPJ completo.')).toBeInTheDocument();
    expect(screen.getByText('Informe um valor maior que zero.')).toBeInTheDocument();
    expect(screen.getByText('Informe a competência.')).toBeInTheDocument();
    expect(screen.getByText('Informe o vencimento.')).toBeInTheDocument();
    expect(screen.getByText('Escolha a categoria.')).toBeInTheDocument();
    expect(postsToRequests()).toHaveLength(0);
  });

  test('FINANCE não vê o formulário', async () => {
    loginAs('financeiro@gex.test');
    renderApp('/requests/new');

    expect(await screen.findByText('Acesso restrito')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar solicitação' })).not.toBeInTheDocument();
  });
});
