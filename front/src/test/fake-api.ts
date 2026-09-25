import { delay, http, HttpResponse, type JsonBodyType } from 'msw';
import type { components } from '../api/schema';
import { DASHBOARDS, REFERENCE_DATE, REQUESTS, SEED_PASSWORDS, USERS } from './fixtures';

// Fake da API em MSW: responde no formato do contrato (tipos gerados), com o estado em memória.
// Não reimplementa as regras do back: é só o suficiente pros testes de componente e de fluxo.
type Schemas = components['schemas'];
type Problem = Schemas['Problem'];
type RequestDetail = Schemas['RequestDetail'];
type User = Schemas['User'];

const TITLES: Record<number, string> = {
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

export function problem(
  status: number,
  code: Problem['code'],
  detail: string,
  extra: { errors?: Problem['errors']; headers?: Record<string, string> } = {},
) {
  const body: Problem = {
    type: 'about:blank',
    title: TITLES[status] ?? 'Error',
    status,
    code,
    detail,
    ...(extra.errors ? { errors: extra.errors } : {}),
  };
  return HttpResponse.json(body, {
    status,
    headers: { 'Content-Type': 'application/problem+json', ...extra.headers },
  });
}

function json<T extends JsonBodyType>(body: T, status = 200) {
  return HttpResponse.json(body, { status });
}

type FakeState = {
  currentUser: User | null;
  requests: RequestDetail[];
  requestLog: { method: string; url: URL; body: unknown; headers: Headers }[];
};

export const state: FakeState = { currentUser: null, requests: [], requestLog: [] };

export function resetFakeApi(): void {
  state.currentUser = null;
  state.requests = structuredClone(REQUESTS);
  state.requestLog = [];
}

export function loginAs(email: string): User {
  const user = USERS.find((u) => u.email === email);
  if (!user) throw new Error(`usuário de fixture inexistente: ${email}`);
  state.currentUser = user;
  return user;
}

export const FINANCE_EMAIL = 'financeiro@gex.test';
export const REQUESTER_EMAIL = 'solicitante@gex.test';

function unauthenticated() {
  return problem(401, 'UNAUTHENTICATED', 'Sessão ausente ou expirada.');
}

function visibleTo(user: User, request: RequestDetail): boolean {
  return user.role === 'FINANCE' || request.requester.id === user.id;
}

function withoutAccents(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function toListItem(r: RequestDetail): Schemas['RequestListItem'] {
  return {
    id: r.id,
    supplier_name: r.supplier_name,
    invoice_number: r.invoice_number,
    amount_cents: r.amount_cents,
    due_date: r.due_date,
    status: r.status,
    is_overdue: r.is_overdue,
    requester: r.requester,
  };
}

async function log(request: Request): Promise<void> {
  const text = request.method === 'GET' ? '' : await request.clone().text();
  const body: unknown = text === '' ? null : JSON.parse(text);
  state.requestLog.push({
    method: request.method,
    url: new URL(request.url),
    body,
    headers: request.headers,
  });
}

// Todo POST sem o header anti-CSRF recebe 403, como no back (§8.3).
function missingCsrf(request: Request): boolean {
  return request.headers.get('X-Requested-With') !== 'gex-web';
}

export const handlers = [
  http.all('*/api/*', async ({ request }) => {
    await log(request);
    if (request.method === 'POST' && missingCsrf(request)) {
      return problem(403, 'FORBIDDEN', 'Header anti-CSRF ausente.');
    }
    return undefined;
  }),

  http.post('*/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email: string; password: string };
    const user = USERS.find((u) => u.email === body.email);
    if (!user || SEED_PASSWORDS[user.email] !== body.password) {
      return problem(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
    }
    state.currentUser = user;
    return json<Schemas['LoginResponse']>({ user });
  }),

  http.post('*/api/auth/logout', () => {
    if (!state.currentUser) return unauthenticated();
    state.currentUser = null;
    return new HttpResponse(null, { status: 204 });
  }),

  http.get('*/api/auth/me', () => {
    if (!state.currentUser) return unauthenticated();
    return json<Schemas['Me']>({ user: state.currentUser, reference_date: REFERENCE_DATE });
  }),

  http.get('*/api/dashboard/summary', () => {
    const user = state.currentUser;
    if (!user) return unauthenticated();
    const numbers = DASHBOARDS[user.id];
    if (!numbers) throw new Error(`sem dashboard de fixture para ${user.id}`);
    return json<Schemas['DashboardSummary']>({ ...numbers, reference_date: REFERENCE_DATE });
  }),

  http.get('*/api/requests', ({ request }) => {
    const user = state.currentUser;
    if (!user) return unauthenticated();
    const params = new URL(request.url).searchParams;
    const status = params.get('status');
    const supplier = params.get('supplier');
    const dueFrom = params.get('due_from');
    const dueTo = params.get('due_to');
    const page = Number(params.get('page') ?? '1');
    const pageSize = Number(params.get('page_size') ?? '20');

    const filtered = state.requests
      .filter((r) => visibleTo(user, r))
      .filter((r) => (status ? r.status === status : true))
      .filter((r) =>
        supplier ? withoutAccents(r.supplier_name).includes(withoutAccents(supplier)) : true,
      )
      .filter((r) => (dueFrom ? r.due_date >= dueFrom : true))
      .filter((r) => (dueTo ? r.due_date <= dueTo : true))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    const total = filtered.length;
    return json<Schemas['RequestList']>({
      data: filtered.slice((page - 1) * pageSize, page * pageSize).map(toListItem),
      page,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
      reference_date: REFERENCE_DATE,
    });
  }),

  http.get('*/api/requests/:id', ({ params }) => {
    const user = state.currentUser;
    if (!user) return unauthenticated();
    const found = state.requests.find((r) => r.id === params.id && visibleTo(user, r));
    if (!found) return problem(404, 'NOT_FOUND', 'Solicitação não encontrada.');
    return json<RequestDetail>(found);
  }),

  http.post('*/api/requests', async ({ request }) => {
    const user = state.currentUser;
    if (!user) return unauthenticated();
    if (user.role !== 'REQUESTER') return problem(403, 'FORBIDDEN', 'Só o solicitante cria.');
    const body = (await request.json()) as Omit<
      RequestDetail,
      'id' | 'requester' | 'status' | 'history'
    >;
    const duplicate = state.requests.some(
      (r) => r.supplier_cnpj === body.supplier_cnpj && r.invoice_number === body.invoice_number,
    );
    if (duplicate) {
      return problem(409, 'DUPLICATE_INVOICE', 'Já existe uma solicitação com este CNPJ e nota.');
    }
    const now = '2026-09-18T10:00:00-03:00';
    const id = `20000000-0000-4000-8000-${String(state.requests.length + 1).padStart(12, '0')}`;
    const created: RequestDetail = {
      id,
      requester: { id: user.id, name: user.name },
      supplier_name: body.supplier_name,
      supplier_cnpj: body.supplier_cnpj,
      invoice_number: body.invoice_number,
      amount_cents: body.amount_cents,
      competence: body.competence,
      due_date: body.due_date,
      category: body.category,
      description: body.description ?? null,
      status: 'PENDING',
      is_overdue: false,
      rejection_reason: null,
      paid_at: null,
      payment_reference: null,
      created_at: now,
      updated_at: now,
      history: [
        {
          id: `30000000-0000-4000-8000-${id.slice(-12)}`,
          previous_status: null,
          new_status: 'PENDING',
          actor: { id: user.id, name: user.name },
          reason: null,
          created_at: now,
        },
      ],
    };
    state.requests.push(created);
    await delay(20);
    return HttpResponse.json(created, { status: 201, headers: { Location: `/requests/${id}` } });
  }),
];
