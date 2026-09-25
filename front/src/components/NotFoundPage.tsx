import { Alert, Anchor } from '@mantine/core';
import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <Alert color="gray" title="Página não encontrada">
      <Anchor component={Link} to="/">
        Voltar ao painel
      </Anchor>
    </Alert>
  );
}
