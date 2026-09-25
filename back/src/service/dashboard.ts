import { monthBoundsSaoPaulo } from '../modules/date.js';
import type { DashboardSummary, User } from '../types/domain.js';

export interface SummaryScope {
  requesterId: string | null;
  referenceDate: string;
  monthStart: Date;
  monthEnd: Date;
}

export interface DashboardRepository {
  summary(scope: SummaryScope): Promise<DashboardSummary>;
}

export interface DashboardView extends DashboardSummary {
  referenceDate: string;
}

export class DashboardService {
  constructor(
    private readonly repo: DashboardRepository,
    private readonly deps: { today: () => string },
  ) {}

  async summary(actor: User): Promise<DashboardView> {
    const referenceDate = this.deps.today();
    const { start, end } = monthBoundsSaoPaulo(referenceDate);
    const summary = await this.repo.summary({
      requesterId: actor.role === 'REQUESTER' ? actor.id : null,
      referenceDate,
      monthStart: start,
      monthEnd: end,
    });
    return { ...summary, referenceDate };
  }
}
