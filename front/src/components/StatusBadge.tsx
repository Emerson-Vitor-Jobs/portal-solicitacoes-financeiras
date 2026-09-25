import { Badge } from '@mantine/core';
import type { components } from '../api/schema';
import { STATUS_COLORS, STATUS_LABELS } from '../lib/labels';

type Status = components['schemas']['RequestStatus'];

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge color={STATUS_COLORS[status]} variant="light">
      {STATUS_LABELS[status]}
    </Badge>
  );
}
