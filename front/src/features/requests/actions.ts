import type { RequestStatus, Role } from '../../api/types';

export type RequestAction = 'approve' | 'reject' | 'markPaid';

export function canCreateRequest(role: Role): boolean {
  return role === 'REQUESTER';
}

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
