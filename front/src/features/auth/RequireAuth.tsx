import { Alert, Button, Center, Loader, Stack } from '@mantine/core';
import { Navigate, Outlet, useLocation } from 'react-router';
import { errorMessage, hasCode } from '../../api/errors';
import { SessionContext, useSessionQuery } from './session';

export function RequireAuth() {
  const location = useLocation();
  const session = useSessionQuery();

  if (session.isPending) {
    return (
      <Center h="100vh">
        <Loader aria-label="Carregando sessão" />
      </Center>
    );
  }

  if (session.isError) {
    if (hasCode(session.error, 'UNAUTHENTICATED')) {
      return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
    }
    return (
      <Center h="100vh">
        <Stack>
          <Alert color="red" title="Não foi possível carregar a sessão">
            {errorMessage(session.error)}
          </Alert>
          <Button onClick={() => void session.refetch()}>Tentar novamente</Button>
        </Stack>
      </Center>
    );
  }

  return (
    <SessionContext.Provider value={session.data}>
      <Outlet />
    </SessionContext.Provider>
  );
}
