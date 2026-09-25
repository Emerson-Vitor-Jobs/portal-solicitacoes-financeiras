import { Button, type ButtonProps } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { Link } from 'react-router';
import { useSession } from '../auth/session';
import { canCreateRequest } from './actions';

type Props = Omit<ButtonProps, 'children' | 'leftSection'> & {
  withIcon?: boolean;
  onClick?: () => void;
};

export function NewRequestButton({ withIcon = false, ...props }: Props) {
  const { user } = useSession();
  if (!canCreateRequest(user.role)) return null;
  return (
    <Button
      {...props}
      component={Link}
      to="/requests/new"
      leftSection={withIcon ? <IconPlus size={18} /> : undefined}
    >
      Nova solicitação
    </Button>
  );
}
