import {
  Box,
  Button,
  Card,
  Group,
  Image,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconFileInvoice } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import teamWalking from '../../assets/humaaans/team-walking.svg';
import brutal from '../../components/brutal.module.css';
import { QueryErrorAlert } from '../../components/QueryErrorAlert';
import { formatBusinessDate, formatMonthLabel } from '../../lib/date';
import { formatCents } from '../../lib/money';
import { palette } from '../../theme';
import { useSession } from '../auth/session';
import { NewRequestButton } from '../requests/NewRequestButton';
import { dashboardQueryKey, fetchSummary } from './api';

type IndicatorProps = { label: string; value: string; hint: string; highlight?: boolean };

// O indicador principal (total pendente, o que espera decisão) vem em destaque escuro, como o card de saldo do
// sistema visual; os demais ficam em cards brancos (§17).
function Indicator({ label, value, hint, highlight = false }: IndicatorProps) {
  return (
    <Card
      component="section"
      aria-label={label}
      bg={highlight ? palette.ink : 'white'}
      c={highlight ? 'white' : undefined}
      withBorder={!highlight}
    >
      <Text size="sm" c={highlight ? 'ink.2' : palette.textSecondary}>
        {label}
      </Text>
      <Text fz={28} fw={600} ff="heading" mt={4}>
        {value}
      </Text>
      <Text size="xs" c={highlight ? 'ink.3' : palette.textSecondary} mt="xs">
        {hint}
      </Text>
    </Card>
  );
}

function WelcomeBanner({ name, isRequester }: { name: string; isRequester: boolean }) {
  const firstName = name.split(' ')[0] ?? name;
  return (
    <Card bg={palette.cream} withBorder={false} p="xl" className={brutal.panel}>
      <Group justify="space-between" align="center" wrap="wrap" gap="xl">
        <Stack gap="sm" maw={560}>
          <Title order={2} size="h3">
            Olá, {firstName}.
          </Title>
          <Text c={palette.textSecondary}>
            {isRequester
              ? 'Cadastre despesas e acompanhe cada uma do envio ao pagamento.'
              : 'Revise o que está pendente e registre os pagamentos aprovados.'}
          </Text>
          <Group gap="sm" mt="xs">
            <NewRequestButton withIcon className={brutal.control} />
            <Button
              component={Link}
              to="/requests?status=PENDING"
              variant="default"
              leftSection={<IconFileInvoice size={18} />}
              className={brutal.control}
            >
              Ver pendentes
            </Button>
            <Button
              component={Link}
              to="/requests?status=APPROVED"
              variant="default"
              className={brutal.control}
            >
              Ver aprovadas
            </Button>
          </Group>
        </Stack>
        <Box visibleFrom="md" style={{ flex: 1, minWidth: 320, maxWidth: 560 }}>
          <Image src={teamWalking} alt="" />
        </Box>
      </Group>
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
        <SimpleGrid
          cols={{ base: 1, sm: 2, lg: 4 }}
          role="status"
          aria-label="Carregando indicadores"
        >
          {[1, 2, 3, 4].map((key) => (
            <Skeleton key={key} h={96} radius="md" />
          ))}
        </SimpleGrid>
      )}
      {summary.isError && (
        <QueryErrorAlert
          title="Não foi possível carregar o painel"
          error={summary.error}
          onRetry={() => void summary.refetch()}
        />
      )}
      {summary.isSuccess && (
        <>
          {/* Os números se autodescrevem pela reference_date do servidor (§14.2). */}
          <Text c={palette.textSecondary} size="sm">
            {scope} Data de referência: {formatBusinessDate(summary.data.reference_date)}.
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
            <Indicator
              highlight
              label="Total pendente"
              value={formatCents(summary.data.pending_amount_cents)}
              hint="Aguardando aprovação ou rejeição"
            />
            <Indicator
              label="Total aprovado"
              value={formatCents(summary.data.approved_amount_cents)}
              hint="Aprovado e ainda não pago"
            />
            <Indicator
              label={`Pago em ${formatMonthLabel(summary.data.reference_date)}`}
              value={formatCents(summary.data.paid_this_month_amount_cents)}
              hint="Pagamentos no mês da data de referência"
            />
            <Indicator
              label="Solicitações vencidas"
              value={String(summary.data.overdue_count)}
              hint="Pendentes ou aprovadas com vencimento anterior à data de referência"
            />
          </SimpleGrid>
        </>
      )}
      <WelcomeBanner name={user.name} isRequester={user.role === 'REQUESTER'} />
    </Stack>
  );
}
