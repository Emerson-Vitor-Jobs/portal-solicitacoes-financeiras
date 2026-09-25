import { Alert } from '@mantine/core';
import type { ReactNode } from 'react';
import type { Role } from '../../api/types';
import { ROLE_LABELS } from '../../lib/labels';
import { useSession } from './session';

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useSession();
  if (user.role !== role) {
    return (
      <Alert color="yellow" title="Acesso restrito">
        Esta tela é exclusiva do perfil {ROLE_LABELS[role]}.
      </Alert>
    );
  }
  return children;
}
