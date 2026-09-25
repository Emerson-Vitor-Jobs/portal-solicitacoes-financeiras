import { Badge } from '@mantine/core';
import { palette } from '../theme';

export function OverdueBadge({ overdue }: { overdue: boolean }) {
  if (!overdue) return null;
  return (
    <Badge color={palette.danger} size="sm">
      Vencida
    </Badge>
  );
}
