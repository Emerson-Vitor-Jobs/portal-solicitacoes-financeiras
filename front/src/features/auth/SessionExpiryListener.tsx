import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { setUnauthenticatedListener } from '../../api/client';
import { sessionQueryKey } from './api';
import type { LoginLocationState } from './login-state';

// Raiz das rotas: liga o 401 UNAUTHENTICATED do client ao roteador. Se havia uma sessão carregada,
// ela caiu no servidor: limpa o cache e manda pro /login com "Sua sessão expirou". Sem sessão
// carregada (primeiro acesso), quem redireciona é o RequireAuth, sem a mensagem.
export function SessionExpiryListener() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    setUnauthenticatedListener(() => {
      if (queryClient.getQueryData(sessionQueryKey) === undefined) return;
      const state: LoginLocationState = { expired: true };
      void navigate('/login', { replace: true, state });
      queryClient.clear();
    });
    return () => setUnauthenticatedListener(null);
  }, [navigate, queryClient]);

  return <Outlet />;
}
