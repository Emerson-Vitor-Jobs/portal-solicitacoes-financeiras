import { Badge } from '@mantine/core';
import type { RequestStatus } from '../api/types';
import { STATUS_COLORS, STATUS_LABELS } from '../lib/labels';

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <Badge color={STATUS_COLORS[status]} style={{ flexShrink: 0, overflow: 'visible' }}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
