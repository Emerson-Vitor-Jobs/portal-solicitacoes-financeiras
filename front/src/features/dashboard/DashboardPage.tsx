import { Alert, Button, Card, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { errorMessage } from '../../api/errors';
import { formatBusinessDate, formatMonthLabel } from '../../lib/date';
import { formatCents } from '../../lib/money';
import { useSession } from '../auth/session';
import { dashboardQueryKey, fetchSummary } from './api';

function Indicator({ label, value }: { label: string; value: string }) {
  return (
    <Card withBorder padding="lg" radius="md" component="section" aria-label={label}>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text fz={28} fw={700}>
        {value}
      </Text>
    </Card>
  );
}

export function DashboardPage() {
  const { user } = useSession();
  const summary = useQuery({ queryKey: dashboardQueryKey, queryFn: fetchSummary });
  const scope =
    user.role === 'FINANCE' ? 'Todas as solicitações.' : 'Somente as suas solicitações.';

  return (
    <Stack>
      <Title order={2}>Painel</Title>
      {summary.isPending && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} aria-label="Carregando indicadores">
          {[1, 2, 3, 4].map((key) => (
            <Skeleton key={key} h={96} radius="md" />
          ))}
        </SimpleGrid>
      )}
      {summary.isError && (
        <Alert color="red" title="Não foi possível carregar o painel">
          <Stack gap="xs" align="flex-start">
            {errorMessage(summary.error)}
            <Button size="xs" variant="light" onClick={() => void summary.refetch()}>
              Tentar novamente
            </Button>
          </Stack>
        </Alert>
      )}
      {summary.isSuccess && (
        <>
          {/* Os números se autodescrevem pela reference_date do servidor (§14.2). */}
          <Text c="dimmed" size="sm">
            {scope} Data de referência: {formatBusinessDate(summary.data.reference_date)}.
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            <Indicator
              label="Total pendente"
              value={formatCents(summary.data.pending_amount_cents)}
            />
            <Indicator
              label="Total aprovado"
              value={formatCents(summary.data.approved_amount_cents)}
            />
            <Indicator
              label={`Pago em ${formatMonthLabel(summary.data.reference_date)}`}
              value={formatCents(summary.data.paid_this_month_amount_cents)}
            />
            <Indicator label="Solicitações vencidas" value={String(summary.data.overdue_count)} />
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
}
