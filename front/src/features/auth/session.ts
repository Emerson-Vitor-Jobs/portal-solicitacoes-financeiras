import { useQuery } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import { fetchMe, sessionQueryKey, type Me } from './api';

// Sessão = resposta do GET /auth/me (usuário + reference_date do servidor, §14.2). O cookie HttpOnly é
// a única credencial; aqui fica só o que a API devolveu.
export function useSessionQuery() {
  return useQuery({ queryKey: sessionQueryKey, queryFn: fetchMe, staleTime: 60_000 });
}

export const SessionContext = createContext<Me | null>(null);

// Usado só dentro de RequireAuth, onde a sessão já foi carregada.
export function useSession(): Me {
  const session = useContext(SessionContext);
  if (session === null) {
    throw new Error('useSession fora de <RequireAuth>');
  }
  return session;
}
