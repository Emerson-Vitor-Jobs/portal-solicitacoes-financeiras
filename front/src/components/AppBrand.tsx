import { Center, Group, Title } from '@mantine/core';
import { palette } from '../theme';

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

export function AppBrand({ lineHeight }: { lineHeight: number }) {
  return (
    <Group gap="sm" wrap="nowrap">
      <BrandMark />
      <Title order={1} size="h4" lh={lineHeight} style={{ whiteSpace: 'nowrap' }}>
        Portal Financeiro
      </Title>
    </Group>
  );
}
