import { beforeEach, describe, expect, test } from 'vitest';
import { FakeRequestRepository } from '../../test/support/fake_requests.js';
import { ANA, BRUNO, FERNANDA } from '../../test/support/users.js';
import { STATUSES, type Status } from '../types/common.js';
import {
  DuplicateInvoiceError,
  ForbiddenError,
  InvalidTransitionError,
  NotFoundError,
  ValidationError,
} from './errors.js';
import { RequestService, type CreateRequestInput } from './requests.js';

const ID = '20000000-0000-4000-8000-0000000000aa';
const APPROVED_AT = new Date('2026-09-10T11:00:00-03:00');

let repo: FakeRequestRepository;
let service: RequestService;
let ids: number;
let clock: Date;

beforeEach(() => {
  repo = new FakeRequestRepository();
  ids = 0;
  clock = new Date('2026-09-18T15:00:00-03:00');
  service = new RequestService(repo, {
    today: () => '2026-09-18',
    now: () => clock,
    newId: () => `30000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`,
  });
});

const input = (overrides: Partial<CreateRequestInput> = {}): CreateRequestInput => ({
  supplierName: 'Aurora Serviços Digitais',
  supplierCnpj: '10.000.000/0001-45',
  invoiceNumber: ' nf-2026-9001 ',
  amountCents: 155313,
  competence: '2026-09',
  dueDate: '2026-09-30',
  category: 'SERVIÇOS',
  description: '',
  ...overrides,
});

function seedIn(status: Status) {
  return repo.seed(
    {
      id: ID,
      status,
      ...(status === 'REJECTED' ? { rejectionReason: 'reason' } : {}),
      ...(status === 'PAID'
        ? { paidAt: new Date('2026-09-12T10:00:00-03:00'), paymentReference: 'PAG-1' }
        : {}),
    },
    status === 'APPROVED' || status === 'PAID' ? APPROVED_AT : undefined,
  );
}

describe('create', () => {
  test('normalizes CNPJ and invoice, stores PENDING and the null → PENDING event', async () => {
    const created = await service.create(ANA, input());
    expect(created).toMatchObject({
      supplierCnpj: '10000000000145',
      invoiceNumber: 'NF-2026-9001',
      status: 'PENDING',
      description: null,
      requester: { id: ANA.id },
      isOverdue: false,
    });
    expect(created.history).toMatchObject([
      { previousStatus: null, newStatus: 'PENDING', actor: { id: ANA.id } },
    ]);
  });

  test('#11 CNPJ with a wrong check digit → 422 on supplier_cnpj, nothing stored', async () => {
    const err = await service
      .create(ANA, input({ supplierCnpj: '10000000000146' }))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).errors).toEqual([
      { field: 'supplier_cnpj', message: 'CNPJ inválido.' },
    ]);
    expect(repo.requests.size).toBe(0);
  });

  test('#2 duplicate (same CNPJ and invoice, written differently) → DuplicateInvoiceError, no extra row', async () => {
    await service.create(ANA, input());
    await expect(
      service.create(
        BRUNO,
        input({ supplierCnpj: '10000000000145', invoiceNumber: 'NF-2026-9001' }),
      ),
    ).rejects.toThrow(DuplicateInvoiceError);
    expect(repo.requests.size).toBe(1);
    expect(repo.events).toHaveLength(1);
  });

  test('FINANCE cannot create a request', async () => {
    await expect(service.create(FERNANDA, input())).rejects.toThrow(ForbiddenError);
  });
});

describe('#5 transitions through the service: every status × every action', () => {
  const actions = {
    APPROVED: (id: string) => service.approve(FERNANDA, id),
    REJECTED: (id: string) => service.reject(FERNANDA, id, 'over budget'),
    PAID: (id: string) =>
      service.markPaid(FERNANDA, id, {
        paidAt: new Date('2026-09-15T10:00:00-03:00'),
        paymentReference: 'PAG-9',
      }),
  } as const;
  const allowed: Record<Status, Status[]> = {
    PENDING: ['APPROVED', 'REJECTED'],
    APPROVED: ['PAID'],
    REJECTED: [],
    PAID: [],
  };

  for (const from of STATUSES) {
    for (const to of ['APPROVED', 'REJECTED', 'PAID'] as const) {
      const ok = allowed[from].includes(to);
      test(`${from} → ${to}: ${ok ? 'allowed' : '409 INVALID_TRANSITION'}`, async () => {
        seedIn(from);
        const before = repo.events.length;
        if (ok) {
          const updated = await actions[to](ID);
          expect(updated.status).toBe(to);
          expect(updated.history.at(-1)).toMatchObject({
            previousStatus: from,
            newStatus: to,
            actor: { id: FERNANDA.id },
          });
          expect(repo.events).toHaveLength(before + 1);
        } else {
          const err = await actions[to](ID).catch((e: unknown) => e);
          expect(err).toBeInstanceOf(InvalidTransitionError);
          expect((err as Error).message).toBe(
            `A solicitação está ${from}; não pode ir para ${to}.`,
          );
          expect(repo.requests.get(ID)?.status).toBe(from);
          expect(repo.events).toHaveLength(before);
        }
      });
    }
  }
});

describe('transition rules', () => {
  test('#7 rejecting with a blank reason → 422 on reason', async () => {
    seedIn('PENDING');
    const err = await service.reject(FERNANDA, ID, '   ').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).errors).toMatchObject([{ field: 'reason' }]);
    expect(repo.requests.get(ID)?.status).toBe('PENDING');
  });

  test('rejection stores the reason on the request and on the event', async () => {
    seedIn('PENDING');
    const updated = await service.reject(FERNANDA, ID, '  over budget ');
    expect(updated.rejectionReason).toBe('over budget');
    expect(updated.history.at(-1)?.reason).toBe('over budget');
  });

  test('#4 REQUESTER cannot approve, reject or pay', async () => {
    seedIn('PENDING');
    await expect(service.approve(ANA, ID)).rejects.toThrow(ForbiddenError);
    await expect(service.reject(ANA, ID, 'x')).rejects.toThrow(ForbiddenError);
    await expect(
      service.markPaid(ANA, ID, { paidAt: APPROVED_AT, paymentReference: 'x' }),
    ).rejects.toThrow(ForbiddenError);
  });

  test('race loser: the status changed between the read and the UPDATE → 409 with the new status', async () => {
    seedIn('PENDING');
    repo.beforeUpdate = (requests) => {
      const r = requests.get(ID);
      if (r) requests.set(ID, { ...r, status: 'REJECTED', rejectionReason: 'someone else' });
      repo.beforeUpdate = null;
    };
    await expect(service.approve(FERNANDA, ID)).rejects.toThrow(
      'A solicitação está REJECTED; não pode ir para APPROVED.',
    );
  });

  test('unknown or non-UUID id → 404', async () => {
    await expect(service.approve(FERNANDA, ID)).rejects.toThrow(NotFoundError);
    await expect(service.approve(FERNANDA, 'abc')).rejects.toThrow(NotFoundError);
  });
});

describe('#14 payment date guards', () => {
  const pay = (paidAt: string) =>
    service.markPaid(FERNANDA, ID, { paidAt: new Date(paidAt), paymentReference: 'PAG-77' });

  test('exactly the real clock now is accepted', async () => {
    seedIn('APPROVED');
    const paid = await pay(clock.toISOString());
    expect(paid).toMatchObject({ status: 'PAID', paymentReference: 'PAG-77' });
    expect(paid.paidAt?.toISOString()).toBe(clock.toISOString());
    expect(paid.history.at(-1)).toMatchObject({ newStatus: 'PAID', reason: 'PAG-77' });
  });

  test('future (1 s after the real now) → 422 paid_at', async () => {
    seedIn('APPROVED');
    const err = await pay(new Date(clock.getTime() + 1000).toISOString()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).errors).toMatchObject([
      { field: 'paid_at', message: 'A data de pagamento não pode ser futura.' },
    ]);
    expect(repo.requests.get(ID)?.status).toBe('APPROVED');
  });

  test('later on the same reference day but after the real now → 422', async () => {
    seedIn('APPROVED');
    await expect(pay('2026-09-18T23:59:59-03:00')).rejects.toThrow(ValidationError);
  });

  test('before the approval → 422 paid_at and the UPDATE is rolled back', async () => {
    seedIn('APPROVED');
    const before = repo.events.length;
    const err = await pay('2026-09-10T10:59:59-03:00').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).errors).toMatchObject([
      { field: 'paid_at', message: 'O pagamento não pode ser anterior à aprovação.' },
    ]);
    expect(repo.requests.get(ID)).toMatchObject({ status: 'APPROVED', paidAt: null });
    expect(repo.events).toHaveLength(before);
  });

  test('approve and pay in the same minute: the form time (no seconds) is accepted', async () => {
    clock = new Date('2026-09-25T14:52:10-03:00');
    seedIn('APPROVED');
    repo.events.at(-1)!.createdAt = new Date('2026-09-25T14:51:37-03:00');
    await expect(pay('2026-09-25T14:51:00-03:00')).resolves.toMatchObject({ status: 'PAID' });
  });

  test('the minute before the approval is still rejected', async () => {
    clock = new Date('2026-09-25T14:52:10-03:00');
    seedIn('APPROVED');
    repo.events.at(-1)!.createdAt = new Date('2026-09-25T14:51:37-03:00');
    await expect(pay('2026-09-25T14:50:59-03:00')).rejects.toThrow(ValidationError);
  });

  test('APP_TODAY in the past and approval "now": paying "now" is accepted', async () => {
    clock = new Date('2026-09-25T15:00:00-03:00');
    seedIn('APPROVED');
    repo.events.at(-1)!.createdAt = new Date('2026-09-25T14:59:00-03:00');
    await expect(pay(clock.toISOString())).resolves.toMatchObject({ status: 'PAID' });
  });

  test('the exact approval instant is accepted', async () => {
    seedIn('APPROVED');
    await expect(pay(APPROVED_AT.toISOString())).resolves.toMatchObject({ status: 'PAID' });
  });
});

describe('reading and scope', () => {
  test('#13 REQUESTER cannot see another person request: 404, same as unknown', async () => {
    seedIn('PENDING');
    await expect(service.get(BRUNO, ID)).rejects.toThrow(NotFoundError);
    await expect(service.get(ANA, ID)).resolves.toMatchObject({ id: ID });
    await expect(service.get(FERNANDA, ID)).resolves.toMatchObject({ id: ID });
  });

  test('#12 is_overdue against the reference date: due today is not overdue', async () => {
    repo.seed({ id: ID, dueDate: '2026-09-18' });
    expect((await service.get(ANA, ID)).isOverdue).toBe(false);
    repo.seed({ id: ID, dueDate: '2026-09-17' });
    expect((await service.get(ANA, ID)).isOverdue).toBe(true);
  });

  test('list: REQUESTER sees only their own; total_pages rounds up', async () => {
    for (let i = 1; i <= 3; i++) {
      repo.seed({ id: `${ID.slice(0, -2)}0${i}` });
    }
    repo.seed({ id: `${ID.slice(0, -2)}09`, requester: { id: BRUNO.id, name: BRUNO.name } });
    const page = await service.list(ANA, {
      status: undefined,
      supplier: undefined,
      dueFrom: undefined,
      dueTo: undefined,
      page: 1,
      pageSize: 2,
    });
    expect(page).toMatchObject({ total: 3, totalPages: 2, page: 1, pageSize: 2 });
    expect(page.items).toHaveLength(2);
    expect(page.referenceDate).toBe('2026-09-18');
  });
});
