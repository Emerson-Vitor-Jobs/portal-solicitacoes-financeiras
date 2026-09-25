// Fontes empacotadas no build (funcionam sem internet): IBM Plex Sans nos títulos, Roboto no corpo (§17).
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';

import { useState } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { createQueryClient } from './lib/query-client';
import { AppProviders } from './providers';
import { routes } from './routes';

export function App() {
  const [queryClient] = useState(() => createQueryClient());
  const [router] = useState(() => createBrowserRouter(routes));
  return (
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
