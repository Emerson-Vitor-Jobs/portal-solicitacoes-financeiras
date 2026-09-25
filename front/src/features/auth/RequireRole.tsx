import { Alert } from '@mantine/core';
import type { ReactNode } from 'react';
import type { Role } from './api';
import { useSession } from './session';

// Esconde a tela de quem não tem o papel. A autorização de verdade é do back (403); isto é só UX.
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user } = useSession();
  if (user.role !== role) {
    return (
      <Alert color="yellow" title="Acesso restrito">
        Esta tela é exclusiva do perfil {role === 'FINANCE' ? 'Financeiro' : 'Solicitante'}.
      </Alert>
    );
  }
  return children;
}
