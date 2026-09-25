import { MantineProvider } from '@mantine/core';
import { render as testingLibraryRender } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { createQueryClient } from '../src/lib/query-client';
import { AppProviders } from '../src/providers';
import { routes } from '../src/routes';

// Todo teste de componente renderiza dentro do MantineProvider (env="test" desliga transições).
export function render(ui: ReactNode) {
  return testingLibraryRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MantineProvider env="test">{children}</MantineProvider>
    ),
  });
}

// Renderiza o app inteiro (rotas reais, QueryClient novo) numa URL inicial.
export function renderApp(initialPath: string) {
  const queryClient = createQueryClient({ retry: false });
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const view = testingLibraryRender(
    <AppProviders queryClient={queryClient} env="test">
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...view, router, queryClient };
}
