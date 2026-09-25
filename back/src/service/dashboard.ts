// Indicadores do dashboard (DECISOES_FUNDACAO §14.2). O escopo vem do papel e os limites de calendário vêm da
// data de referência em America/Sao_Paulo; o banco só agrega.
import { monthBoundsSaoPaulo } from '../modules/date.js';
import type { DashboardSummary, User } from '../types/domain.js';

export interface SummaryScope {
  // null = todas (FINANCE); o id = só as da pessoa (REQUESTER).
  requesterId: string | null;
  // Vencida = vencimento < referência (§6.0: o "hoje" é parâmetro, nunca CURRENT_DATE).
  referenceDate: string;
  // "Pago no mês" = paid_at em [monthStart, monthEnd).
  monthStart: Date;
  monthEnd: Date;
}

// Porta de saída (o consumidor define a interface).
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
