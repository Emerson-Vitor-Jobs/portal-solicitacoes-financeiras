import { AppShell, Box, Burger, Group, NavLink, ScrollArea, Stack, Text } from '@mantine/core';
import { useDisclosure, useLocalStorage } from '@mantine/hooks';
import {
  IconFileInvoice,
  IconLayoutDashboard,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import { NavLink as RouterNavLink, Outlet } from 'react-router';
import { useSession } from '../features/auth/session';
import { useLogout } from '../features/auth/use-logout';
import { NewRequestButton } from '../features/requests/NewRequestButton';
import { ROLE_LABELS } from '../lib/labels';
import { useIsMobile } from '../lib/use-is-mobile';
import { palette } from '../theme';
import { AppBrand } from './AppBrand';
import classes from './AppLayout.module.css';
import brutal from './brutal.module.css';
import { BrutalIconButton } from './BrutalIconButton';
import { LogoutButton } from './LogoutButton';
import { UserAvatar } from './UserAvatar';

type MenuItem = { to: string; label: string; icon: ReactNode; end?: boolean };

const MENU: MenuItem[] = [
  { to: '/', label: 'Painel', icon: <IconLayoutDashboard size={20} stroke={1.8} />, end: true },
  { to: '/requests', label: 'Solicitações', icon: <IconFileInvoice size={20} stroke={1.8} /> },
];

export function AppLayout() {
  const { user } = useSession();
  const [mobileNavbarOpened, { toggle: toggleMobileNavbar, close: closeMobileNavbar }] =
    useDisclosure(false);
  const [desktopNavbarOpened, setDesktopNavbarOpened] = useLocalStorage({
    key: 'gex:sidebar-open',
    defaultValue: false,
  });
  const isMobile = useIsMobile();
  const headerVisible = isMobile === true || !desktopNavbarOpened;
  const navbarVisible = isMobile === true ? mobileNavbarOpened : desktopNavbarOpened;
  const logoutMutation = useLogout();
  const logoutProps = {
    loading: logoutMutation.isPending,
    onLogout: () => logoutMutation.mutate(),
  };

  return (
    <AppShell
      header={{ height: 64, collapsed: !headerVisible }}
      navbar={{
        width: 272,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileNavbarOpened, desktop: !desktopNavbarOpened },
      }}
      padding="lg"
      styles={{ main: { backgroundColor: palette.background } }}
    >
      <AppShell.Header bg={palette.cream} className={brutal.bottomEdge}>
        {headerVisible && (
          <Group h="100%" px="md" justify="space-between" wrap="nowrap">
            <Group wrap="nowrap" gap="sm">
              <Burger
                opened={mobileNavbarOpened}
                onClick={toggleMobileNavbar}
                hiddenFrom="sm"
                size="sm"
                aria-label="Menu"
              />
              <BrutalIconButton
                label="Abrir menu"
                visibleFrom="sm"
                onClick={() => setDesktopNavbarOpened(true)}
              >
                <IconLayoutSidebarLeftExpand size={18} />
              </BrutalIconButton>
              <AppBrand lineHeight={1.2} />
            </Group>
            <Group wrap="nowrap" gap="sm">
              <UserAvatar id={user.id} name={user.name} size={36} />
              <Text size="sm" fw={500} visibleFrom="sm">
                {user.name}
              </Text>
              <LogoutButton compact {...logoutProps} />
            </Group>
          </Group>
        )}
      </AppShell.Header>

      <AppShell.Navbar
        p="md"
        aria-label="Menu lateral"
        bg={palette.cream}
        className={brutal.endEdge}
      >
        {navbarVisible && (
          <>
            <AppShell.Section>
              <Group justify="space-between" wrap="nowrap" mb="lg">
                <AppBrand lineHeight={1.1} />
                <BrutalIconButton
                  label="Fechar menu"
                  visibleFrom="sm"
                  onClick={() => setDesktopNavbarOpened(false)}
                >
                  <IconLayoutSidebarLeftCollapse size={18} />
                </BrutalIconButton>
              </Group>
            </AppShell.Section>

            <AppShell.Section grow component={ScrollArea}>
              <Stack gap={6}>
                {MENU.map((item) => (
                  <NavLink
                    key={item.to}
                    component={RouterNavLink}
                    to={item.to}
                    end={item.end}
                    label={item.label}
                    leftSection={item.icon}
                    onClick={closeMobileNavbar}
                    className={classes.navlink}
                  />
                ))}
              </Stack>

              <NewRequestButton
                withIcon
                onClick={closeMobileNavbar}
                fullWidth
                mt="lg"
                className={brutal.sidebarPrimaryControl}
              />
            </AppShell.Section>

            <AppShell.Section>
              <Box p="sm" bg="white" className={brutal.panel}>
                <Group gap="sm" wrap="nowrap" mb="sm">
                  <UserAvatar id={user.id} name={user.name} size={44} />
                  <Box miw={0}>
                    <Text fw={600} truncate>
                      {user.name}
                    </Text>
                    <Text size="xs" c={palette.textSecondary}>
                      {ROLE_LABELS[user.role]}
                    </Text>
                  </Box>
                </Group>
                <LogoutButton {...logoutProps} />
              </Box>
            </AppShell.Section>
          </>
        )}
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
