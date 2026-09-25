import { MantineProvider } from '@mantine/core';
import { render as testingLibraryRender } from '@testing-library/react';
import type { ReactNode } from 'react';

// Todo teste de componente renderiza dentro do MantineProvider (env="test" desliga transições).
export function render(ui: ReactNode) {
  return testingLibraryRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MantineProvider env="test">{children}</MantineProvider>
    ),
  });
}
