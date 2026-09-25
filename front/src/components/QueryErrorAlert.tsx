import { Alert, Button, Stack } from '@mantine/core';
import type { ReactNode } from 'react';
import { errorMessage } from '../api/errors';

type Props = {
  title: string;
  error?: unknown;
  onRetry?: () => void;
  color?: string;
  children?: ReactNode;
};

export function QueryErrorAlert({ title, error, onRetry, color = 'red', children }: Props) {
  return (
    <Alert color={color} title={title}>
      <Stack gap="xs" align="flex-start">
        {error !== undefined && errorMessage(error)}
        {onRetry && (
          <Button size="xs" variant="light" onClick={onRetry}>
            Tentar novamente
          </Button>
        )}
        {children}
      </Stack>
    </Alert>
  );
}
