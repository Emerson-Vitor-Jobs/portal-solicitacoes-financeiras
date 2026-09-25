import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { setUnauthenticatedListener } from '../../api/client';
import { sessionQueryKey } from './api';
import type { LoginLocationState } from './login-state';

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
