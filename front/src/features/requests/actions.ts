import type { Role } from '../auth/api';
import type { RequestStatus } from './api';

export type RequestAction = 'approve' | 'reject' | 'markPaid';

// Ações que a tela oferece por papel e status. É só UX: quem garante é o back (403/409). Segue as
// transições do enunciado: PENDING → APPROVED | REJECTED, APPROVED → PAID; estados finais sem ação.
export function availableActions(role: Role, status: RequestStatus): RequestAction[] {
  if (role === 'REQUESTER') return [];
  switch (status) {
    case 'PENDING':
      return ['approve', 'reject'];
    case 'APPROVED':
      return ['markPaid'];
    case 'REJECTED':
    case 'PAID':
      return [];
  }
}
