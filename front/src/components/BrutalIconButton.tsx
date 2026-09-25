import { ActionIcon, Tooltip, type ActionIconProps } from '@mantine/core';
import type { ReactNode } from 'react';
import brutal from './brutal.module.css';

type Props = Pick<ActionIconProps, 'loading' | 'visibleFrom'> & {
  label: string;
  onClick: () => void;
  children: ReactNode;
};

export function BrutalIconButton({ label, onClick, children, ...props }: Props) {
  return (
    <Tooltip label={label}>
      <ActionIcon
        {...props}
        variant="default"
        size="lg"
        radius="md"
        aria-label={label}
        onClick={onClick}
        className={brutal.control}
      >
        {children}
      </ActionIcon>
    </Tooltip>
  );
}
