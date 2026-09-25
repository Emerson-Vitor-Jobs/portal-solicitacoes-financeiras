import { describe, expect, test } from 'vitest';
import { FakeDashboardRepository } from '../../test/support/server.js';
import { ANA, FERNANDA } from '../../test/support/users.js';
import { DashboardService } from './dashboard.js';

describe('dashboard: scope and calendar', () => {
  test('FINANCE sees all; REQUESTER only their own', async () => {
    const repo = new FakeDashboardRepository();
    const service = new DashboardService(repo, { today: () => '2026-09-18' });
    await service.summary(FERNANDA);
    await service.summary(ANA);
    expect(repo.scopes.map((s) => s.requesterId)).toEqual([null, ANA.id]);
  });

  test('#12 "paid this month" uses the reference month in SP, half-open interval', async () => {
    const repo = new FakeDashboardRepository();
    const view = await new DashboardService(repo, { today: () => '2026-09-18' }).summary(FERNANDA);
    expect(view.referenceDate).toBe('2026-09-18');
    const [scope] = repo.scopes;
    expect(scope?.referenceDate).toBe('2026-09-18');
    expect(scope?.monthStart.toISOString()).toBe('2026-09-01T03:00:00.000Z');
    expect(scope?.monthEnd.toISOString()).toBe('2026-10-01T03:00:00.000Z');
  });
});
