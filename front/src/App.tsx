import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';

import { MantineProvider, Title } from '@mantine/core';

// Rotas, QueryClient e telas entram na E6.
export function App() {
  return (
    <MantineProvider>
      <Title order={1}>Portal de Solicitações Financeiras</Title>
    </MantineProvider>
  );
}
