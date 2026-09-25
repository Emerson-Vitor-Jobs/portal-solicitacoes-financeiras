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
import { StatusBadge } from '../../components/StatusBadge';
import { formatCnpj } from '../../lib/cnpj';
import { formatBusinessDate, formatCompetence, formatInstant } from '../../lib/date';
import { CATEGORY_LABELS, STATUS_LABELS } from '../../lib/labels';
import { formatCents } from '../../lib/money';
import { useSession } from '../auth/session';
import { ApproveModal, MarkPaidModal, RejectModal } from './ActionModals';
import { availableActions, type RequestAction } from './actions';
import { fetchRequest, requestKeys, type RequestDetail } from './api';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Text size="xs" c="dimmed" component="dt">
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
    <Card withBorder radius="md" padding="lg">
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} component="dl" m={0}>
        <Field label="Fornecedor">{request.supplier_name}</Field>
        <Field label="CNPJ">{formatCnpj(request.supplier_cnpj)}</Field>
        <Field label="Nota fiscal">{request.invoice_number}</Field>
        <Field label="Valor">{formatCents(request.amount_cents)}</Field>
        <Field label="Competência">{formatCompetence(request.competence)}</Field>
        <Field label="Vencimento">
          <Group gap="xs" component="span">
            {formatBusinessDate(request.due_date)}
            <OverdueBadge overdue={request.is_overdue} />
          </Group>
        </Field>
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
    return <Text c="dimmed">Sem eventos registrados.</Text>;
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
          <Text size="sm" c="dimmed">
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

const ACTION_BUTTONS: Record<RequestAction, { label: string; color: string }> = {
  approve: { label: 'Aprovar', color: 'blue' },
  reject: { label: 'Rejeitar', color: 'red' },
  markPaid: { label: 'Marcar como pago', color: 'green' },
};

export function RequestDetailPage() {
  const { id = '' } = useParams();
  const { user } = useSession();
  const [openAction, setOpenAction] = useState<RequestAction | null>(null);
  const detail = useQuery({ queryKey: requestKeys.detail(id), queryFn: () => fetchRequest(id) });

  if (detail.isPending) {
    return (
      <Stack aria-label="Carregando solicitação">
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
      <Alert
        color={notFound ? 'gray' : 'red'}
        title={notFound ? 'Solicitação não encontrada' : 'Não foi possível carregar a solicitação'}
      >
        <Stack gap="xs" align="flex-start">
          {!notFound && errorMessage(detail.error)}
          {!notFound && (
            <Button size="xs" variant="light" onClick={() => void detail.refetch()}>
              Tentar novamente
            </Button>
          )}
          <Anchor component={Link} to="/requests">
            Voltar para a lista
          </Anchor>
        </Stack>
      </Alert>
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

      <RequestData request={request} />

      <Title order={3}>Histórico</Title>
      <History request={request} />

      {openAction === 'approve' && <ApproveModal request={request} onClose={close} />}
      {openAction === 'reject' && <RejectModal request={request} onClose={close} />}
      {openAction === 'markPaid' && <MarkPaidModal request={request} onClose={close} />}
    </Stack>
  );
}
