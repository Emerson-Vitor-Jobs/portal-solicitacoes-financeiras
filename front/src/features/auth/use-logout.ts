import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { errorMessage } from '../../api/errors';
import { logout } from './api';

export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await navigate('/login', { replace: true });
      queryClient.clear();
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Não foi possível sair',
        message: errorMessage(error),
      });
    },
  });
}
