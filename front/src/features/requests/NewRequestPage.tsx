import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { errorMessage, isApiError } from '../../api/errors';
import { BusinessDateInput } from '../../components/BusinessDateInput';
import { CnpjInput } from '../../components/CnpjInput';
import { MoneyInput } from '../../components/MoneyInput';
import { CATEGORY_LABELS, enumValues } from '../../lib/labels';
import { useSubmitLock } from '../../lib/use-submit-lock';
import { useSession } from '../auth/session';
import { dashboardQueryKey } from '../dashboard/api';
import { createRequest, requestKeys } from './api';
import {
  emptyNewRequest,
  formFieldFor,
  newRequestSchema,
  toCreateBody,
  type NewRequestInput,
  type NewRequestOutput,
} from './new-request-schema';

const CATEGORY_OPTIONS = enumValues(CATEGORY_LABELS).map((value) => ({
  value,
  label: CATEGORY_LABELS[value],
}));

export function NewRequestPage() {
  const { reference_date } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const lock = useSubmitLock();
  // Erros que não pertencem a um campo do formulário (ex.: 403, 500, campo desconhecido no 422).
  const [formError, setFormError] = useState<string | null>(null);

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
        form.setError(
          'invoice_number',
          { message: 'Já existe uma solicitação com este CNPJ e número de nota fiscal.' },
          { shouldFocus: true },
        );
        return;
      }
      if (isApiError(error) && error.code === 'VALIDATION_FAILED') {
        const unmatched: string[] = [];
        for (const fieldError of error.fieldErrors) {
          const field = formFieldFor(fieldError.field);
          if (field) form.setError(field, { message: fieldError.message });
          else unmatched.push(fieldError.message);
        }
        setFormError(unmatched.length > 0 ? unmatched.join(' ') : null);
        return;
      }
      setFormError(errorMessage(error));
    },
    onSettled: () => lock.release(),
  });

  const submit = form.handleSubmit(
    (values) => {
      setFormError(null);
      mutation.mutate(toCreateBody(values));
    },
    () => lock.release(),
  );

  return (
    <Stack maw={880}>
      <Title order={2}>Nova solicitação</Title>
      <Paper withBorder p="lg" radius="md">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            // Anti-duplo-envio: o segundo clique é ignorado enquanto o primeiro não termina.
            if (!lock.tryAcquire()) return;
            submit(event).catch((error: unknown) => {
              lock.release();
              setFormError(errorMessage(error));
            });
          }}
        >
          <Stack>
            {formError && (
              <Alert color="red" role="alert" title="Não foi possível criar a solicitação">
                {formError}
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
            <Group justify="flex-end">
              <Button variant="default" onClick={() => void navigate('/requests')}>
                Cancelar
              </Button>
              <Button type="submit" loading={mutation.isPending} disabled={mutation.isPending}>
                Enviar solicitação
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
