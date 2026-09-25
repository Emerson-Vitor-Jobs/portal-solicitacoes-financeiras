import { Avatar, type AvatarProps } from '@mantine/core';
import { avatarColors, brutal } from '../theme';

type Props = { id: string; name: string } & Omit<AvatarProps, 'name' | 'color'>;

// Cor estável por usuário: a mesma pessoa tem sempre a mesma cor, em qualquer tela.
function colorFor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return avatarColors[hash % avatarColors.length] ?? avatarColors[0];
}

// Avatar com as iniciais do nome, no traço neo-brutalista da barra lateral.
export function UserAvatar({ id, name, ...props }: Props) {
  return (
    <Avatar
      name={name}
      color={colorFor(id)}
      variant="filled"
      radius="xl"
      alt={name}
      style={{ border: brutal.border }}
      {...props}
    />
  );
}
