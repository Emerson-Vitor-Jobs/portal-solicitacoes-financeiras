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
