import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isApiError, type FieldError } from '../../api/errors';
import { useSubmitLock } from '../../lib/use-submit-lock';
import { dashboardQueryKey } from '../dashboard/api';
import { requestKeys, type RequestDetail } from './api';

type Options = {
  successMessage: string;
  onClose: () => void;
  onFieldErrors?: (fieldErrors: FieldError[]) => void;
};

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
      options.onClose();
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
        options.onClose();
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
    if (!lock.tryAcquire()) return;
    mutation.mutate(body);
  }

  return { mutation, submit };
}
