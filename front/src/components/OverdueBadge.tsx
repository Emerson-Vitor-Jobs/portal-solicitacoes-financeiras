import { Badge } from '@mantine/core';

// Selo pelo `is_overdue` que vem da API: o front não compara datas (§14.2).
export function OverdueBadge({ overdue }: { overdue: boolean }) {
  if (!overdue) return null;
  return (
    <Badge color="red" variant="filled" size="sm">
      Vencida
    </Badge>
  );
}
