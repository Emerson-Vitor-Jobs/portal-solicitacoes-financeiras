import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isApiError, type FieldError } from '../../api/errors';
import { useSubmitLock } from '../../lib/use-submit-lock';
import { dashboardQueryKey } from '../dashboard/api';
import { requestKeys, type RequestDetail } from './api';

type Options = {
  successMessage: string;
  // Fecha o modal (sucesso ou conflito de estado).
  onDone: () => void;
  // Erros por campo do 422, para o formulário do modal.
  onFieldErrors?: (errors: FieldError[]) => void;
};

// Mutação de uma ação de status (aprovar, rejeitar, pagar), com o tratamento comum:
// - sucesso: o detalhe vem no corpo (200), atualiza o cache sem GET extra e marca lista e painel;
// - 409 INVALID_TRANSITION (transição inválida ou perdeu a corrida, §5.5): avisa e recarrega;
// - 422: devolve os errors[] ao formulário; o resto fica em `mutation.error` para o modal mostrar.
export function useRequestAction<TBody>(
  id: string,
  call: (id: string, body: TBody) => Promise<RequestDetail>,
  options: Options,
) {
  const queryClient = useQueryClient();
  const lock = useSubmitLock();

  const mutation = useMutation({
    mutationFn: (body: TBody) => call(id, body),
    onSuccess: async (updated) => {
      queryClient.setQueryData(requestKeys.detail(id), updated);
      notifications.show({ color: 'green', message: options.successMessage });
      options.onDone();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: requestKeys.lists }),
        queryClient.invalidateQueries({ queryKey: dashboardQueryKey }),
      ]);
    },
    onError: async (error) => {
      if (isApiError(error) && error.code === 'INVALID_TRANSITION') {
        notifications.show({
          color: 'orange',
          title: 'A solicitação mudou de status',
          message: 'Outra pessoa alterou esta solicitação antes. Os dados foram recarregados.',
        });
        options.onDone();
        await queryClient.invalidateQueries({ queryKey: requestKeys.all });
        return;
      }
      if (isApiError(error) && error.code === 'VALIDATION_FAILED') {
        options.onFieldErrors?.(error.fieldErrors);
      }
    },
    onSettled: () => lock.release(),
  });

  function submit(body: TBody): void {
    // Anti-duplo-envio: o segundo clique não chega à API.
    if (!lock.tryAcquire()) return;
    mutation.mutate(body);
  }

  return { mutation, submit };
}
