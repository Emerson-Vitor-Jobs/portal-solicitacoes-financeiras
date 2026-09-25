import { Button } from '@mantine/core';
import { IconLogout } from '@tabler/icons-react';
import brutal from './brutal.module.css';
import { BrutalIconButton } from './BrutalIconButton';

type Props = { compact?: boolean; loading: boolean; onLogout: () => void };

export function LogoutButton({ compact = false, loading, onLogout }: Props) {
  if (compact) {
    return (
      <BrutalIconButton label="Sair" onClick={onLogout} loading={loading}>
        <IconLogout size={18} />
      </BrutalIconButton>
    );
  }
  return (
    <Button
      fullWidth
      variant="default"
      leftSection={<IconLogout size={18} />}
      onClick={onLogout}
      loading={loading}
      className={brutal.sidebarControl}
    >
      Sair
    </Button>
  );
}
