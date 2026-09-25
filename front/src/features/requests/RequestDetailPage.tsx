import {
  Alert,
  Anchor,
  Button,
  Card,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  Timeline,
  Title,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { errorMessage, hasCode } from '../../api/errors';
import { OverdueBadge } from '../../components/OverdueBadge';
import { QueryErrorAlert } from '../../components/QueryErrorAlert';
import { StatusBadge } from '../../components/StatusBadge';
import { formatCnpj } from '../../lib/cnpj';
import { formatBusinessDate, formatCompetence, formatInstant } from '../../lib/date';
import { CATEGORY_LABELS, STATUS_LABELS } from '../../lib/labels';
import { formatCents } from '../../lib/money';
import { palette } from '../../theme';
import { useSession } from '../auth/session';
import { ApproveModal, MarkPaidModal, RejectModal } from './ActionModals';
import { availableActions, type RequestAction } from './actions';
import { fetchRequest, requestKeys, type RequestDetail } from './api';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Text size="xs" c={palette.textSecondary} component="dt">
        {label}
      </Text>
      <Text component="dd" m={0}>
        {children}
      </Text>
    </div>
  );
}

function RequestData({ request }: { request: RequestDetail }) {
  return (
    <Card>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} component="dl" m={0}>
        <Field label="Fornecedor">{request.supplier_name}</Field>
        <Field label="CNPJ">{formatCnpj(request.supplier_cnpj)}</Field>
        <Field label="Nota fiscal">{request.invoice_number}</Field>
        <Field label="Competência">{formatCompetence(request.competence)}</Field>
        <Field label="Vencimento">{formatBusinessDate(request.due_date)}</Field>
        <Field label="Categoria">{CATEGORY_LABELS[request.category]}</Field>
        <Field label="Solicitante">{request.requester.name}</Field>
        <Field label="Status">
          <StatusBadge status={request.status} />
        </Field>
        <Field label="Criada em">{formatInstant(request.created_at)}</Field>
        <Field label="Atualizada em">{formatInstant(request.updated_at)}</Field>
        {request.rejection_reason !== null && (
          <Field label="Motivo da rejeição">{request.rejection_reason}</Field>
        )}
        {request.paid_at !== null && (
          <Field label="Pago em">{formatInstant(request.paid_at)}</Field>
        )}
        {request.payment_reference !== null && (
          <Field label="Referência do pagamento">{request.payment_reference}</Field>
        )}
      </SimpleGrid>
      {request.description !== null && (
        <Stack gap={0} mt="md" component="dl">
          <Field label="Descrição">{request.description}</Field>
        </Stack>
      )}
    </Card>
  );
}

// Histórico só de leitura (a auditoria não é editável pela interface).
function History({ request }: { request: RequestDetail }) {
  if (request.history.length === 0) {
    return <Text c={palette.textSecondary}>Sem eventos registrados.</Text>;
  }
  return (
    <Timeline active={request.history.length - 1} bulletSize={14} lineWidth={2}>
      {request.history.map((event) => (
        <Timeline.Item
          key={event.id}
          title={
            event.previous_status === null
              ? `Criada como ${STATUS_LABELS[event.new_status]}`
              : `${STATUS_LABELS[event.previous_status]} → ${STATUS_LABELS[event.new_status]}`
          }
        >
          <Text size="sm" c={palette.textSecondary}>
            {event.actor.name} · {formatInstant(event.created_at)}
          </Text>
          {event.reason !== null && (
            // No pagamento, o `reason` do evento é a referência do pagamento (como nos eventos do seed).
            <Text size="sm">
              {event.new_status === 'PAID' ? 'Referência' : 'Motivo'}: {event.reason}
            </Text>
          )}
        </Timeline.Item>
      ))}
    </Timeline>
  );
}

// Ação principal em preto (a cor de ação do sistema visual, §17); rejeitar é destrutiva, em vermelho com contorno.
const ACTION_BUTTONS: Record<
  RequestAction,
  { label: string; variant: 'filled' | 'outline'; color?: string }
> = {
  approve: { label: 'Aprovar', variant: 'filled' },
  reject: { label: 'Rejeitar', variant: 'outline', color: palette.danger },
  markPaid: { label: 'Marcar como pago', variant: 'filled' },
};

export function RequestDetailPage() {
  const { id = '' } = useParams();
  const { user } = useSession();
  const [openAction, setOpenAction] = useState<RequestAction | null>(null);
  const detail = useQuery({ queryKey: requestKeys.detail(id), queryFn: () => fetchRequest(id) });

  if (detail.isPending) {
    return (
      <Stack role="status" aria-label="Carregando solicitação">
        <Skeleton h={32} w={320} />
        <Skeleton h={220} />
      </Stack>
    );
  }

  // Tela de erro só sem dados: um refetch que falha (foco da janela, recarga depois de um 409) não
  // troca a página nem desmonta um modal aberto com o que já foi digitado.
  if (detail.data === undefined) {
    const notFound = hasCode(detail.error, 'NOT_FOUND');
    return (
      <QueryErrorAlert
        color={notFound ? 'gray' : 'red'}
        title={notFound ? 'Solicitação não encontrada' : 'Não foi possível carregar a solicitação'}
        error={notFound ? undefined : detail.error}
        onRetry={notFound ? undefined : () => void detail.refetch()}
      >
        <Anchor component={Link} to="/requests">
          Voltar para a lista
        </Anchor>
      </QueryErrorAlert>
    );
  }

  const request = detail.data;
  const actions = availableActions(user.role, request.status);
  const close = () => setOpenAction(null);

  return (
    <Stack>
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Anchor component={Link} to="/requests" size="sm">
            ← Solicitações
          </Anchor>
          <Group gap="sm">
            <Title order={2}>{request.supplier_name}</Title>
            <StatusBadge status={request.status} />
          </Group>
        </Stack>
        {actions.length > 0 && (
          <Group aria-label="Ações">
            {actions.map((action) => (
              <Button
                key={action}
                color={ACTION_BUTTONS[action].color}
                variant={ACTION_BUTTONS[action].variant}
                onClick={() => setOpenAction(action)}
              >
                {ACTION_BUTTONS[action].label}
              </Button>
            ))}
          </Group>
        )}
      </Group>

      {detail.isError && (
        <Alert color="yellow" title="Não foi possível atualizar a solicitação">
          {errorMessage(detail.error)} Os dados abaixo podem estar desatualizados.
        </Alert>
      )}

      {/* O valor em destaque, como o total do recibo no sistema visual (§17). */}
      <Card bg={palette.cream} withBorder={false}>
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <div>
            <Text size="sm" c={palette.textSecondary}>
              Valor
            </Text>
            <Text fz={32} fw={600} ff="heading" lh={1.2}>
              {formatCents(request.amount_cents)}
            </Text>
          </div>
          <Group gap="xs">
            <Text size="sm" c={palette.textSecondary}>
              Vencimento {formatBusinessDate(request.due_date)}
            </Text>
            <OverdueBadge overdue={request.is_overdue} />
          </Group>
        </Group>
      </Card>

      <RequestData request={request} />

      <Card>
        <Stack>
          <Title order={3} size="h4">
            Histórico
          </Title>
          <History request={request} />
        </Stack>
      </Card>

      {openAction === 'approve' && <ApproveModal request={request} onClose={close} />}
      {openAction === 'reject' && <RejectModal request={request} onClose={close} />}
      {openAction === 'markPaid' && <MarkPaidModal request={request} onClose={close} />}
    </Stack>
  );
}
