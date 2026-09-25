import {
  ActionIcon,
  AppShell,
  Box,
  Burger,
  Button,
  Center,
  Group,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure, useLocalStorage, useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconFileInvoice,
  IconLayoutDashboard,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLogout,
  IconPlus,
} from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link, NavLink as RouterNavLink, Outlet, useNavigate } from 'react-router';
import { errorMessage } from '../api/errors';
import { logout } from '../features/auth/api';
import { useSession } from '../features/auth/session';
import { ROLE_LABELS } from '../lib/labels';
import { brutal, palette } from '../theme';
import classes from './AppLayout.module.css';
import { UserAvatar } from './UserAvatar';

// Marca: um círculo preto com o cifrão, igual ao favicon. Decorativa (o título ao lado já nomeia).
function BrandMark() {
  return (
    <Center
      aria-hidden
      w={36}
      h={36}
      bg={palette.ink}
      c={palette.cream}
      fw={700}
      style={{ borderRadius: '50%', flexShrink: 0 }}
    >
      $
    </Center>
  );
}

type MenuItem = { to: string; label: string; icon: ReactNode; end?: boolean };

export function AppLayout() {
  const { user } = useSession();
  // Celular: a lateral é uma gaveta aberta pelo hambúrguer do topo.
  const [mobileOpened, { toggle: toggleMobile, close: closeMobile }] = useDisclosure(false);
  // Desktop: lateral aberta ou fechada, lembrada neste navegador. Aberta → o topo some; fechada → o topo volta.
  const [desktopOpened, setDesktopOpened] = useLocalStorage({
    key: 'gex:sidebar-aberta',
    defaultValue: true,
  });
  // Abaixo do breakpoint `sm` (48em) a lateral vira gaveta, e o topo (com o hambúrguer) fica sempre visível.
  const isMobile = useMediaQuery('(max-width: 48em)');
  const headerVisible = isMobile === true || !desktopOpened;
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

  const menu: MenuItem[] = [
    { to: '/', label: 'Painel', icon: <IconLayoutDashboard size={20} stroke={1.8} />, end: true },
    {
      to: '/requests',
      label: 'Solicitações',
      icon: <IconFileInvoice size={20} stroke={1.8} />,
      end: true,
    },
  ];

  const logoutButton = (compact: boolean) =>
    compact ? (
      <Tooltip label="Sair">
        <ActionIcon
          variant="default"
          size="lg"
          radius="md"
          aria-label="Sair"
          onClick={() => logoutMutation.mutate()}
          loading={logoutMutation.isPending}
          style={{ border: brutal.border, boxShadow: brutal.shadowSmall }}
        >
          <IconLogout size={18} />
        </ActionIcon>
      </Tooltip>
    ) : (
      <Button
        fullWidth
        variant="default"
        leftSection={<IconLogout size={18} />}
        onClick={() => logoutMutation.mutate()}
        loading={logoutMutation.isPending}
        style={{ border: brutal.border, boxShadow: brutal.shadowSmall, borderRadius: 10 }}
      >
        Sair
      </Button>
    );

  return (
    <AppShell
      header={{ height: 64, collapsed: !headerVisible }}
      navbar={{
        width: 272,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: !desktopOpened },
      }}
      padding="lg"
      styles={{ main: { backgroundColor: palette.background } }}
    >
      {/* Topo: aparece com a lateral fechada (desktop) e sempre no celular. Recolhido, o conteúdo nem é
          renderizado: sem itens invisíveis pro leitor de tela nem pro Tab. */}
      <AppShell.Header bg={palette.cream} style={{ borderBottom: brutal.border }}>
        {headerVisible && (
          <Group h="100%" px="md" justify="space-between" wrap="nowrap">
            <Group wrap="nowrap" gap="sm">
              <Burger
                opened={mobileOpened}
                onClick={toggleMobile}
                hiddenFrom="sm"
                size="sm"
                aria-label="Menu"
              />
              <Tooltip label="Abrir menu">
                <ActionIcon
                  visibleFrom="sm"
                  variant="default"
                  size="lg"
                  radius="md"
                  aria-label="Abrir menu"
                  onClick={() => setDesktopOpened(true)}
                  style={{ border: brutal.border, boxShadow: brutal.shadowSmall }}
                >
                  <IconLayoutSidebarLeftExpand size={18} />
                </ActionIcon>
              </Tooltip>
              <BrandMark />
              <Title order={1} size="h4" lh={1.2}>
                Portal Financeiro
              </Title>
            </Group>
            <Group wrap="nowrap" gap="sm">
              <UserAvatar id={user.id} name={user.name} size={36} />
              <Text size="sm" fw={500} visibleFrom="sm">
                {user.name}
              </Text>
              {logoutButton(true)}
            </Group>
          </Group>
        )}
      </AppShell.Header>

      {/* Lateral neo-brutalista: marca, navegação, ação principal e o usuário com o botão de sair. */}
      <AppShell.Navbar
        p="md"
        aria-label="Menu principal"
        bg={palette.cream}
        style={{ borderRight: brutal.border }}
      >
        <AppShell.Section>
          <Group justify="space-between" wrap="nowrap" mb="lg">
            <Group gap="sm" wrap="nowrap">
              <BrandMark />
              <Title order={1} size="h4" lh={1.1} style={{ whiteSpace: 'nowrap' }}>
                Portal Financeiro
              </Title>
            </Group>
            <Tooltip label="Fechar menu">
              <ActionIcon
                visibleFrom="sm"
                variant="default"
                size="lg"
                radius="md"
                aria-label="Fechar menu"
                onClick={() => setDesktopOpened(false)}
                style={{ border: brutal.border, boxShadow: brutal.shadowSmall }}
              >
                <IconLayoutSidebarLeftCollapse size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </AppShell.Section>

        <AppShell.Section grow component={ScrollArea}>
          <Stack gap={6}>
            {menu.map((item) => (
              <NavLink
                key={item.to}
                component={RouterNavLink}
                to={item.to}
                end={item.end}
                label={item.label}
                leftSection={item.icon}
                onClick={closeMobile}
                className={classes.navlink}
              />
            ))}
          </Stack>

          {/* Criar é do solicitante (POST /requests é do REQUESTER): abre o modal sobre a lista. */}
          {user.role === 'REQUESTER' && (
            <Button
              component={Link}
              to="/requests/new"
              onClick={closeMobile}
              fullWidth
              mt="lg"
              leftSection={<IconPlus size={18} />}
              style={{ border: brutal.border, boxShadow: brutal.shadow, borderRadius: 10 }}
            >
              Nova solicitação
            </Button>
          )}
        </AppShell.Section>

        <AppShell.Section>
          <Box
            p="sm"
            bg="white"
            style={{ border: brutal.border, boxShadow: brutal.shadow, borderRadius: brutal.radius }}
          >
            <UnstyledButton component="div" w="100%" mb="sm">
              <Group gap="sm" wrap="nowrap">
                <UserAvatar id={user.id} name={user.name} size={44} />
                <Box style={{ minWidth: 0 }}>
                  <Text fw={600} truncate>
                    {user.name}
                  </Text>
                  <Text size="xs" c={palette.textSecondary}>
                    {ROLE_LABELS[user.role]}
                  </Text>
                </Box>
              </Group>
            </UnstyledButton>
            {logoutButton(false)}
          </Box>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
