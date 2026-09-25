import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Group, Modal, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage, isApiError } from '../../api/errors';
import { BusinessDateInput } from '../../components/BusinessDateInput';
import { ModalActions } from '../../components/ModalActions';
import {
  formatBusinessDate,
  isBusinessDate,
  isTime,
  nowInSaoPaulo,
  toSaoPauloRfc3339,
} from '../../lib/date';
import { applyFieldErrors, type ApiFieldMap } from '../../lib/form-errors';
import { formatCents } from '../../lib/money';
import { palette } from '../../theme';
import { decideRequest, markRequestPaid, type RequestDetail } from './api';
import { useRequestAction } from './use-request-action';

type ModalProps = { request: RequestDetail; onClose: () => void };

function NonFieldMutationError({
  error,
  fieldMap,
}: {
  error: unknown;
  fieldMap: Readonly<Record<string, string>>;
}) {
  if (error === null) return null;
  if (isApiError(error) && error.code === 'VALIDATION_FAILED' && error.fieldErrors.length > 0) {
    const unmatched = error.fieldErrors.filter(
      (fieldError) => !Object.hasOwn(fieldMap, fieldError.field),
    );
    if (unmatched.length === 0) return null;
    return (
      <Alert color="red" role="alert" title="Dados inválidos">
        {unmatched.map((fieldError) => (
          <Text key={`${fieldError.field}:${fieldError.message}`} size="sm">
            {fieldError.message}
          </Text>
        ))}
      </Alert>
    );
  }
  return (
    <Alert color="red" role="alert">
      {errorMessage(error)}
    </Alert>
  );
}

function RequestSummary({ request }: { request: RequestDetail }) {
  return (
    <Text size="sm">
      {request.supplier_name} · nota {request.invoice_number} · {formatCents(request.amount_cents)}
    </Text>
  );
}

const NO_FIELDS = {};

export function ApproveModal({ request, onClose }: ModalProps) {
  const { mutation, submit } = useRequestAction(request.id, decideRequest, {
    successMessage: 'Solicitação aprovada.',
    onClose,
  });
  return (
    <Modal opened onClose={onClose} title="Aprovar solicitação">
      <Stack>
        <RequestSummary request={request} />
        <NonFieldMutationError error={mutation.error} fieldMap={NO_FIELDS} />
        <ModalActions
          confirmLabel="Confirmar aprovação"
          loading={mutation.isPending}
          onCancel={onClose}
          onConfirm={() => submit({ decision: 'APPROVE' })}
        />
      </Stack>
    </Modal>
  );
}

const rejectSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Informe o motivo da rejeição.')
    .max(500, 'Use no máximo 500 caracteres.'),
});
type RejectForm = z.infer<typeof rejectSchema>;

const REJECT_FIELD_MAP: ApiFieldMap<RejectForm> = { reason: 'reason' };

export function RejectModal({ request, onClose }: ModalProps) {
  const form = useForm<RejectForm>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { reason: '' },
  });
  const { mutation, submit } = useRequestAction(request.id, decideRequest, {
    successMessage: 'Solicitação rejeitada.',
    onClose,
    onFieldErrors: (fieldErrors) => applyFieldErrors(form.setError, fieldErrors, REJECT_FIELD_MAP),
  });
  const onSubmit = form.handleSubmit(({ reason }) => submit({ decision: 'REJECT', reason }));

  return (
    <Modal opened onClose={onClose} title="Rejeitar solicitação">
      <form noValidate onSubmit={(event) => void onSubmit(event)}>
        <Stack>
          <RequestSummary request={request} />
          <NonFieldMutationError error={mutation.error} fieldMap={REJECT_FIELD_MAP} />
          <Textarea
            label="Motivo da rejeição"
            withAsterisk
            rows={3}
            {...form.register('reason')}
            error={form.formState.errors.reason?.message}
          />
          <ModalActions
            confirmLabel="Confirmar rejeição"
            confirmColor={palette.danger}
            loading={mutation.isPending}
            onCancel={onClose}
          />
        </Stack>
      </form>
    </Modal>
  );
}

function markPaidSchema(today: string) {
  return z.object({
    paid_date: z
      .string()
      .nullable()
      .refine((value) => value !== null && isBusinessDate(value), 'Informe a data do pagamento.')
      .refine(
        (value) => value === null || value <= today,
        `A data não pode passar de hoje (${formatBusinessDate(today)}).`,
      ),
    paid_time: z.string().refine(isTime, 'Informe a hora (hh:mm).'),
    payment_reference: z
      .string()
      .trim()
      .min(1, 'Informe a referência do pagamento.')
      .max(100, 'Use no máximo 100 caracteres.'),
  });
}
type MarkPaidForm = z.infer<ReturnType<typeof markPaidSchema>>;

const MARK_PAID_FIELD_MAP: ApiFieldMap<MarkPaidForm> = {
  paid_at: 'paid_date',
  payment_reference: 'payment_reference',
};

export function MarkPaidModal({ request, onClose }: ModalProps) {
  const [openedAt] = useState(() => nowInSaoPaulo());
  const form = useForm<MarkPaidForm>({
    resolver: zodResolver(markPaidSchema(openedAt.date)),
    defaultValues: { paid_date: openedAt.date, paid_time: openedAt.time, payment_reference: '' },
  });
  const { mutation, submit } = useRequestAction(request.id, markRequestPaid, {
    successMessage: 'Pagamento registrado.',
    onClose,
    onFieldErrors: (fieldErrors) =>
      applyFieldErrors(form.setError, fieldErrors, MARK_PAID_FIELD_MAP),
  });
  const onSubmit = form.handleSubmit((values) => {
    if (values.paid_date === null) return;
    submit({
      paid_at: toSaoPauloRfc3339(values.paid_date, values.paid_time),
      payment_reference: values.payment_reference,
    });
  });
  const { errors } = form.formState;

  return (
    <Modal opened onClose={onClose} title="Registrar pagamento">
      <form noValidate onSubmit={(event) => void onSubmit(event)}>
        <Stack>
          <RequestSummary request={request} />
          <NonFieldMutationError error={mutation.error} fieldMap={MARK_PAID_FIELD_MAP} />
          <Group grow align="flex-start">
            <Controller
              control={form.control}
              name="paid_date"
              render={({ field }) => (
                <BusinessDateInput
                  label="Data do pagamento"
                  withAsterisk
                  maxDate={openedAt.date}
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.paid_date?.message}
                />
              )}
            />
            <TimeInput
              label="Hora (São Paulo)"
              withAsterisk
              {...form.register('paid_time')}
              error={errors.paid_time?.message}
            />
          </Group>
          <TextInput
            label="Referência do pagamento"
            withAsterisk
            placeholder="Ex.: PAG-2026-0001"
            {...form.register('payment_reference')}
            error={errors.payment_reference?.message}
          />
          <ModalActions
            confirmLabel="Confirmar pagamento"
            loading={mutation.isPending}
            onCancel={onClose}
          />
        </Stack>
      </form>
    </Modal>
  );
}
