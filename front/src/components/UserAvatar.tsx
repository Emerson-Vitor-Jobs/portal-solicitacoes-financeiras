import { Avatar, type AvatarProps } from '@mantine/core';
import { avatarColors } from '../theme';
import brutal from './brutal.module.css';

type Props = { id: string; name: string } & Omit<AvatarProps, 'name' | 'color'>;

function stableColorFor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return avatarColors[hash % avatarColors.length] ?? avatarColors[0];
}

export function UserAvatar({ id, name, ...props }: Props) {
  return (
    <Avatar
      name={name}
      color={stableColorFor(id)}
      variant="filled"
      radius="xl"
      alt={name}
      className={brutal.outlined}
      {...props}
    />
  );
}
