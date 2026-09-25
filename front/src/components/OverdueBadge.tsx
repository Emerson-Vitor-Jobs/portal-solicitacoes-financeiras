import { Badge } from '@mantine/core';

// Selo pelo `is_overdue` que vem da API: o front não compara datas (§14.2).
export function OverdueBadge({ overdue }: { overdue: boolean }) {
  if (!overdue) return null;
  return (
    // Vermelho escuro (contraste AA com texto branco): o único alerta forte da tela, pra não competir com os status.
    <Badge color="#B42318" variant="filled" size="sm">
      Vencida
    </Badge>
  );
}
