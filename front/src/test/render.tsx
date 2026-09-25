import { render as testingLibraryRender } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { createQueryClient } from '../lib/query-client';
import { AppProviders } from '../providers';
import { routes } from '../routes';

function createTestQueryClient() {
  return createQueryClient({ retry: false });
}

export function render(ui: ReactNode) {
  const queryClient = createTestQueryClient();
  return testingLibraryRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <AppProviders queryClient={queryClient} env="test">
        {children}
      </AppProviders>
    ),
  });
}

export function renderApp(initialPath: string) {
  const queryClient = createTestQueryClient();
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const view = testingLibraryRender(
    <AppProviders queryClient={queryClient} env="test">
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...view, router, queryClient };
}
