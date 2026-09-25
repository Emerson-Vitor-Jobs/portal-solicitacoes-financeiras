import {
  AppShell,
  Badge,
  Burger,
  Button,
  Center,
  Group,
  NavLink,
  Text,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { NavLink as RouterNavLink, Outlet, useNavigate } from 'react-router';
import { errorMessage } from '../api/errors';
import { logout } from '../features/auth/api';
import { useSession } from '../features/auth/session';
import { ROLE_LABELS } from '../lib/labels';
import { palette } from '../theme';

// Marca: um círculo preto com o "R$", no traço simples do sistema visual. Decorativa (o título ao lado já nomeia).
function BrandMark() {
  return (
    <Center
      aria-hidden
      w={32}
      h={32}
      bg={palette.ink}
      c="white"
      fw={600}
      fz="xs"
      style={{ borderRadius: '50%', flexShrink: 0 }}
    >
      R$
    </Center>
  );
}

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
      header={{ height: 64 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="lg"
      styles={{ main: { backgroundColor: palette.background } }}
    >
      {/* Faixa creme da marca no topo, como nas telas do sistema visual (§17). */}
      <AppShell.Header bg={palette.cream} withBorder={false}>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Menu" />
            <Group gap="xs" wrap="nowrap">
              <BrandMark />
              <Title order={1} size="h4" lh={1.2}>
                Portal de Solicitações Financeiras
              </Title>
            </Group>
          </Group>
          <Group wrap="nowrap" gap="sm">
            <Text size="sm" visibleFrom="sm">
              {user.name}
            </Text>
            <Badge variant="outline" color="ink">
              {ROLE_LABELS[user.role]}
            </Badge>
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
