import { AppShell, Badge, Burger, Button, Group, NavLink, Text, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink as RouterNavLink, Outlet, useNavigate } from 'react-router';
import { errorMessage } from '../api/errors';
import { logout } from '../features/auth/api';
import { useSession } from '../features/auth/session';
import { ROLE_LABELS } from '../lib/labels';

type MenuItem = { to: string; label: string; end?: boolean };

export function AppLayout() {
  const { user } = useSession();
  const [opened, { toggle, close }] = useDisclosure(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const logoutMutation = useMutation({
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

  // Menu por papel: só o solicitante cria solicitação (POST /requests é do REQUESTER).
  const menu: MenuItem[] = [
    { to: '/', label: 'Painel', end: true },
    { to: '/requests', label: 'Solicitações', end: true },
    ...(user.role === 'REQUESTER' ? [{ to: '/requests/new', label: 'Nova solicitação' }] : []),
  ];

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Menu" />
            <Title order={1} size="h4">
              Portal de Solicitações Financeiras
            </Title>
          </Group>
          <Group wrap="nowrap" gap="sm">
            <Text size="sm" visibleFrom="sm">
              {user.name}
            </Text>
            <Badge variant="light">{ROLE_LABELS[user.role]}</Badge>
            <Button
              variant="default"
              size="xs"
              onClick={() => logoutMutation.mutate()}
              loading={logoutMutation.isPending}
            >
              Sair
            </Button>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="sm" aria-label="Menu principal">
        {menu.map((item) => (
          <NavLink
            key={item.to}
            component={RouterNavLink}
            to={item.to}
            end={item.end}
            label={item.label}
            onClick={close}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
