import { Button, Group } from '@mantine/core';

type Props = {
  confirmLabel: string;
  loading: boolean;
  onCancel: () => void;
  onConfirm?: () => void;
  confirmColor?: string;
};

export function ModalActions({ confirmLabel, loading, onCancel, onConfirm, confirmColor }: Props) {
  return (
    <Group justify="flex-end">
      <Button variant="default" onClick={onCancel}>
        Cancelar
      </Button>
      <Button
        type={onConfirm ? 'button' : 'submit'}
        color={confirmColor}
        loading={loading}
        onClick={onConfirm}
      >
        {confirmLabel}
      </Button>
    </Group>
  );
}
