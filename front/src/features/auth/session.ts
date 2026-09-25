import { useQuery } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import { fetchMe, sessionQueryKey, type Me } from './api';

export function useSessionQuery() {
  return useQuery({ queryKey: sessionQueryKey, queryFn: fetchMe, staleTime: 60_000 });
}

export const SessionContext = createContext<Me | null>(null);

export function useSession(): Me {
  const session = useContext(SessionContext);
  if (session === null) {
    throw new Error('useSession called outside <RequireAuth>');
  }
  return session;
}
