import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Button, Group, Modal, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { errorMessage, isApiError } from '../../api/errors';
import { BusinessDateInput } from '../../components/BusinessDateInput';
import {
  formatBusinessDate,
  isBusinessDate,
  isTime,
  nowInSaoPaulo,
  toSaoPauloRfc3339,
} from '../../lib/date';
import { formatCents } from '../../lib/money';
import { decideRequest, markRequestPaid, type RequestDetail } from './api';
import { useRequestAction } from './use-request-action';

type ModalProps = { request: RequestDetail; onClose: () => void };

// Erro que não é de campo (403, 500, 422 sem campo conhecido). O 409 fecha o modal antes.
function MutationError({ error }: { error: unknown }) {
  if (error === null) return null;
  if (isApiError(error) && error.code === 'VALIDATION_FAILED' && error.fieldErrors.length > 0) {
    return null;
  }
  return (
    <Alert color="red" role="alert">
      {errorMessage(error)}
    </Alert>
  );
}

function Summary({ request }: { request: RequestDetail }) {
  return (
    <Text size="sm">
      {request.supplier_name} · nota {request.invoice_number} · {formatCents(request.amount_cents)}
    </Text>
  );
}

export function ApproveModal({ request, onClose }: ModalProps) {
  const { mutation, submit } = useRequestAction(request.id, decideRequest, {
    successMessage: 'Solicitação aprovada.',
    onDone: onClose,
  });
  return (
    <Modal opened onClose={onClose} title="Aprovar solicitação">
      <Stack>
        <Summary request={request} />
        <MutationError error={mutation.error} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            color="blue"
            loading={mutation.isPending}
            disabled={mutation.isPending}
            onClick={() => submit({ decision: 'APPROVE' })}
          >
            Confirmar aprovação
          </Button>
        </Group>
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

export function RejectModal({ request, onClose }: ModalProps) {
  const form = useForm<RejectForm>({
    resolver: zodResolver(rejectSchema),
    defaultValues: { reason: '' },
  });
  const { mutation, submit } = useRequestAction(request.id, decideRequest, {
    successMessage: 'Solicitação rejeitada.',
    onDone: onClose,
    onFieldErrors: (errors) => {
      for (const e of errors)
        if (e.field === 'reason') form.setError('reason', { message: e.message });
    },
  });
  const onSubmit = form.handleSubmit(({ reason }) => submit({ decision: 'REJECT', reason }));

  return (
    <Modal opened onClose={onClose} title="Rejeitar solicitação">
      <form noValidate onSubmit={(event) => void onSubmit(event)}>
        <Stack>
          <Summary request={request} />
          <MutationError error={mutation.error} />
          <Textarea
            label="Motivo da rejeição"
            withAsterisk
            rows={3}
            {...form.register('reason')}
            error={form.formState.errors.reason?.message}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              color="red"
              loading={mutation.isPending}
              disabled={mutation.isPending}
            >
              Confirmar rejeição
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

// Data e hora do pagamento, lidas em America/Sao_Paulo (§6.2). A data não passa da reference_date
// do servidor; as travas de verdade (futuro, antes da aprovação) são do back e voltam como 422.
function markPaidSchema(referenceDate: string) {
  return z.object({
    paid_date: z
      .string()
      .nullable()
      .refine((v) => v !== null && isBusinessDate(v), 'Informe a data do pagamento.')
      .refine(
        (v) => v === null || v <= referenceDate,
        `A data não pode passar de ${formatBusinessDate(referenceDate)}.`,
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

// Pré-preenche com "agora" em SP; se o relógio passou da reference_date (APP_TODAY), usa a
// reference_date, que é o máximo aceito.
function defaultPaidAt(referenceDate: string): { paid_date: string; paid_time: string } {
  const now = nowInSaoPaulo();
  return { paid_date: now.date <= referenceDate ? now.date : referenceDate, paid_time: now.time };
}

export function MarkPaidModal({
  request,
  onClose,
  referenceDate,
}: ModalProps & { referenceDate: string }) {
  const form = useForm<MarkPaidForm>({
    resolver: zodResolver(markPaidSchema(referenceDate)),
    defaultValues: { ...defaultPaidAt(referenceDate), payment_reference: '' },
  });
  const { mutation, submit } = useRequestAction(request.id, markRequestPaid, {
    successMessage: 'Pagamento registrado.',
    onDone: onClose,
    onFieldErrors: (errors) => {
      for (const e of errors) {
        if (e.field === 'paid_at') form.setError('paid_date', { message: e.message });
        if (e.field === 'payment_reference') {
          form.setError('payment_reference', { message: e.message });
        }
      }
    },
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
          <Summary request={request} />
          <MutationError error={mutation.error} />
          <Group grow align="flex-start">
            <Controller
              control={form.control}
              name="paid_date"
              render={({ field }) => (
                <BusinessDateInput
                  label="Data do pagamento"
                  withAsterisk
                  maxDate={referenceDate}
                  defaultDate={referenceDate}
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
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              color="green"
              loading={mutation.isPending}
              disabled={mutation.isPending}
            >
              Confirmar pagamento
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
