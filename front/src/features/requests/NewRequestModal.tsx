import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Modal, Select, SimpleGrid, Stack, Textarea, TextInput, Title } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router';
import { errorMessage, isApiError } from '../../api/errors';
import { BusinessDateInput } from '../../components/BusinessDateInput';
import { CnpjInput } from '../../components/CnpjInput';
import { ModalActions } from '../../components/ModalActions';
import { MoneyInput } from '../../components/MoneyInput';
import { applyFieldErrors } from '../../lib/form-errors';
import { CATEGORY_LABELS, enumOptions } from '../../lib/labels';
import { useIsMobile } from '../../lib/use-is-mobile';
import { useSubmitLock } from '../../lib/use-submit-lock';
import { useSession } from '../auth/session';
import { dashboardQueryKey } from '../dashboard/api';
import { createRequest, requestKeys } from './api';
import {
  emptyNewRequest,
  NEW_REQUEST_FIELD_MAP,
  newRequestSchema,
  toCreateBody,
  type NewRequestInput,
  type NewRequestOutput,
} from './new-request-schema';

const CATEGORY_OPTIONS = enumOptions(CATEGORY_LABELS);

export function NewRequestModal() {
  const { reference_date } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const lock = useSubmitLock();
  const [nonFieldError, setNonFieldError] = useState<string | null>(null);

  const form = useForm<NewRequestInput, unknown, NewRequestOutput>({
    resolver: zodResolver(newRequestSchema),
    defaultValues: emptyNewRequest,
  });
  const { errors } = form.formState;

  const mutation = useMutation({
    mutationFn: createRequest,
    onSuccess: async (created) => {
      queryClient.setQueryData(requestKeys.detail(created.id), created);
      await queryClient.invalidateQueries({ queryKey: requestKeys.all, refetchType: 'none' });
      await queryClient.invalidateQueries({ queryKey: dashboardQueryKey, refetchType: 'none' });
      notifications.show({ color: 'green', message: 'Solicitação criada.' });
      await navigate(`/requests/${created.id}`);
    },
    onError: (error) => {
      if (isApiError(error) && error.code === 'DUPLICATE_INVOICE') {
        form.setError('invoice_number', { message: errorMessage(error) }, { shouldFocus: true });
        return;
      }
      if (isApiError(error) && error.code === 'VALIDATION_FAILED') {
        const unmatched = applyFieldErrors(form.setError, error.fieldErrors, NEW_REQUEST_FIELD_MAP);
        setNonFieldError(
          unmatched.length > 0 ? unmatched.map((fieldError) => fieldError.message).join(' ') : null,
        );
        return;
      }
      setNonFieldError(errorMessage(error));
    },
    onSettled: () => lock.release(),
  });

  const submit = form.handleSubmit(
    (values) => {
      setNonFieldError(null);
      mutation.mutate(toCreateBody(values));
    },
    () => lock.release(),
  );

  const close = () => {
    if (mutation.isPending) return;
    const openedFromDirectLink = location.key === 'default';
    if (openedFromDirectLink) void navigate('/requests');
    else void navigate(-1);
  };

  return (
    <Modal
      opened
      onClose={close}
      title={
        <Title order={2} size="h3">
          Nova solicitação
        </Title>
      }
      size="xl"
      radius="md"
      fullScreen={isMobile}
      closeOnClickOutside={!mutation.isPending}
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!lock.tryAcquire()) return;
          submit(event).catch((error: unknown) => {
            lock.release();
            setNonFieldError(errorMessage(error));
          });
        }}
      >
        <Stack>
          {nonFieldError && (
            <Alert color="red" role="alert" title="Não foi possível criar a solicitação">
              {nonFieldError}
            </Alert>
          )}
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Fornecedor"
              withAsterisk
              {...form.register('supplier_name')}
              error={errors.supplier_name?.message}
            />
            <Controller
              control={form.control}
              name="supplier_cnpj"
              render={({ field }) => (
                <CnpjInput
                  label="CNPJ do fornecedor"
                  description="Com ou sem pontuação; aceita o CNPJ alfanumérico."
                  withAsterisk
                  name={field.name}
                  ref={field.ref}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.supplier_cnpj?.message}
                />
              )}
            />
            <TextInput
              label="Número da nota fiscal"
              description="Como está na nota (ex.: NF-2026-1001)."
              withAsterisk
              {...form.register('invoice_number')}
              error={errors.invoice_number?.message}
            />
            <Controller
              control={form.control}
              name="amount"
              render={({ field }) => (
                <MoneyInput
                  label="Valor"
                  description="Digite os números: 155313 vira R$ 1.553,13."
                  withAsterisk
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.amount?.message}
                />
              )}
            />
            <Controller
              control={form.control}
              name="competence"
              render={({ field }) => (
                <MonthPickerInput
                  label="Competência"
                  description="Mês e ano a que a despesa se refere."
                  withAsterisk
                  placeholder="mm/aaaa"
                  valueFormat="MM/YYYY"
                  defaultDate={reference_date}
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.competence?.message}
                />
              )}
            />
            <Controller
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <BusinessDateInput
                  label="Vencimento"
                  description="Data limite de pagamento."
                  withAsterisk
                  defaultDate={reference_date}
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.due_date?.message}
                />
              )}
            />
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <Select
                  label="Categoria"
                  withAsterisk
                  placeholder="Escolha"
                  data={CATEGORY_OPTIONS}
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.category?.message}
                />
              )}
            />
          </SimpleGrid>
          <Textarea
            label="Descrição"
            description="Opcional."
            rows={3}
            {...form.register('description')}
            error={errors.description?.message}
          />
          <ModalActions
            confirmLabel="Enviar solicitação"
            loading={mutation.isPending}
            onCancel={close}
          />
        </Stack>
      </form>
    </Modal>
  );
}
