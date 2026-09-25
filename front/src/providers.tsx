import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import 'dayjs/locale/pt-br';
import type { ReactNode } from 'react';
import { cssVariablesResolver, theme } from './theme';

type Props = { queryClient: QueryClient; children: ReactNode; env?: 'default' | 'test' };

export function AppProviders({ queryClient, children, env = 'default' }: Props) {
  return (
    <MantineProvider theme={theme} cssVariablesResolver={cssVariablesResolver} env={env}>
      <DatesProvider settings={{ locale: 'pt-br' }}>
        <Notifications />
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </DatesProvider>
    </MantineProvider>
  );
}
