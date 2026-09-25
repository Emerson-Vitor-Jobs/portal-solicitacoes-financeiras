// Entidades do domínio, em camelCase (DECISOES_FUNDACAO §3). O formato do banco entra pelo `mapX()` do storage
// e o do contrato sai pelo `toXResponse()` do controller; o domínio não conhece nenhum dos dois.
// Data de negócio = string YYYY-MM-DD; instante = Date (§6.0).
import type { Category, Role, Status } from './common.js';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface UserRef {
  id: string;
  name: string;
}

export interface FinanceRequest {
  id: string;
  requester: UserRef;
  supplierName: string;
  supplierCnpj: string;
  invoiceNumber: string;
  amountCents: number;
  // Mês de competência, YYYY-MM (no banco é o dia 1 do mês, §6.1).
  competence: string;
  dueDate: string;
  category: Category;
  description: string | null;
  status: Status;
  rejectionReason: string | null;
  paidAt: Date | null;
  paymentReference: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditEvent {
  id: string;
  previousStatus: Status | null;
  newStatus: Status;
  actor: UserRef;
  reason: string | null;
  createdAt: Date;
}

// O que o service devolve: a solicitação + o "vencida" calculado no servidor contra a data de referência (§14.2).
export interface RequestView extends FinanceRequest {
  isOverdue: boolean;
}

export interface RequestDetail extends RequestView {
  history: AuditEvent[];
}

export interface DashboardSummary {
  pendingAmountCents: number;
  approvedAmountCents: number;
  paidThisMonthAmountCents: number;
  overdueCount: number;
}
