import { Alert, Title } from '@mantine/core';
import { useLocation } from 'react-router';
import type { LoginLocationState } from './SessionExpiryListener';

// Formulário completo na T4.
export function LoginPage() {
  const location = useLocation();
  const state = (location.state ?? {}) as LoginLocationState;
  return (
    <>
      <Title order={2}>Entrar</Title>
      {state.expired && <Alert color="yellow">Sua sessão expirou. Entre novamente.</Alert>}
    </>
  );
}
