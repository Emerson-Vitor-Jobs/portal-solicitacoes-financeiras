import {
  Anchor,
  Button,
  Card,
  Group,
  Image,
  LoadingOverlay,
  Pagination,
  Select,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import emptyIllustration from '../../assets/doodles/unboxing.svg';
import { BusinessDateInput } from '../../components/BusinessDateInput';
import { OverdueBadge } from '../../components/OverdueBadge';
import { QueryErrorAlert } from '../../components/QueryErrorAlert';
import { StatusBadge } from '../../components/StatusBadge';
import { formatBusinessDate } from '../../lib/date';
import { enumOptions, STATUS_LABELS } from '../../lib/labels';
import { formatCents } from '../../lib/money';
import { palette } from '../../theme';
import { NewRequestButton } from './NewRequestButton';
import { fetchRequests, requestKeys, type RequestListItem } from './api';
import {
  hasAnyFilter,
  parseListParams,
  toListQuery,
  withFilter,
  withPage,
  type FilterName,
} from './list-params';

const STATUS_OPTIONS = enumOptions(STATUS_LABELS);

const SUPPLIER_DEBOUNCE_MS = 400;

function useDebouncedSupplierSearch(urlValue: string, onCommit: (value: string) => void) {
  const [text, setText] = useState(urlValue);
  const [syncedValue, setSyncedValue] = useState(urlValue);
  if (urlValue !== syncedValue) {
    setSyncedValue(urlValue);
    setText(urlValue);
  }
  const commit = useDebouncedCallback(onCommit, SUPPLIER_DEBOUNCE_MS);
  useEffect(() => {
    commit.cancel();
  }, [urlValue, commit]);

  return {
    text,
    onChange(value: string) {
      setText(value);
      commit(value);
    },
    reset() {
      commit.cancel();
      setText('');
    },
  };
}

const noWrapCell = { whiteSpace: 'nowrap' } as const;

function RequestRow({ item }: { item: RequestListItem }) {
  return (
    <Table.Tr>
      <Table.Td>
        <Anchor component={Link} to={`/requests/${item.id}`} fw={600} underline="hover">
          {item.supplier_name}
        </Anchor>
      </Table.Td>
      <Table.Td style={noWrapCell}>{item.invoice_number}</Table.Td>
      <Table.Td ta="right" style={noWrapCell}>
        {formatCents(item.amount_cents)}
      </Table.Td>
      <Table.Td>
        <Group gap="xs" wrap="nowrap">
          {formatBusinessDate(item.due_date)}
          <OverdueBadge overdue={item.is_overdue} />
        </Group>
      </Table.Td>
      <Table.Td style={noWrapCell}>
        <StatusBadge status={item.status} />
      </Table.Td>
      <Table.Td style={noWrapCell}>{item.requester.name}</Table.Td>
    </Table.Tr>
  );
}

export function RequestListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseListParams(searchParams);
  const listQuery = toListQuery(filters);

  const list = useQuery({
    queryKey: requestKeys.list(listQuery),
    queryFn: () => fetchRequests(listQuery),
    placeholderData: keepPreviousData,
  });

  function setFilter(name: FilterName, value: string | null, replace = false) {
    setSearchParams((prev) => withFilter(prev, name, value), { replace });
  }

  const supplier = useDebouncedSupplierSearch(filters.supplier, (value) =>
    setFilter('supplier', value, true),
  );

  function clearFilters() {
    supplier.reset();
    setSearchParams(new URLSearchParams());
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Solicitações</Title>
        <NewRequestButton />
      </Group>

      <Card>
        <Group align="flex-end" wrap="wrap" role="search" aria-label="Filtros">
          <Select
            label="Status"
            placeholder="Todos"
            data={STATUS_OPTIONS}
            value={filters.status}
            onChange={(value) => setFilter('status', value)}
            clearable
            w={180}
          />
          <TextInput
            label="Fornecedor"
            placeholder="Buscar por nome"
            value={supplier.text}
            onChange={(event) => supplier.onChange(event.currentTarget.value)}
          />
          <BusinessDateInput
            label="Vencimento de"
            value={filters.due_from}
            onChange={(value) => setFilter('due_from', value)}
            maxDate={filters.due_to ?? undefined}
            clearable
            w={160}
          />
          <BusinessDateInput
            label="Vencimento até"
            value={filters.due_to}
            onChange={(value) => setFilter('due_to', value)}
            minDate={filters.due_from ?? undefined}
            clearable
            w={160}
          />
          {(hasAnyFilter(filters) || supplier.text !== '') && (
            <Button variant="subtle" onClick={clearFilters}>
              Limpar filtros
            </Button>
          )}
        </Group>
      </Card>

      {list.isPending && (
        <Stack role="status" aria-label="Carregando solicitações">
          {[1, 2, 3, 4, 5].map((key) => (
            <Skeleton key={key} h={36} />
          ))}
        </Stack>
      )}

      {list.isError && (
        <QueryErrorAlert
          title="Não foi possível carregar as solicitações"
          error={list.error}
          onRetry={() => void list.refetch()}
        />
      )}

      {list.isSuccess && list.data.data.length === 0 && (
        <Card>
          <Stack align="center" gap="xs" py="lg" ta="center">
            <Image src={emptyIllustration} alt="" w={180} />
            <Title order={3} size="h4">
              Nenhuma solicitação encontrada
            </Title>
            <Text size="sm" c={palette.textSecondary}>
              {hasAnyFilter(filters) || filters.page > 1
                ? 'Nenhum resultado para os filtros e a página escolhidos.'
                : 'Ainda não há solicitações.'}
            </Text>
            {filters.page > 1 && (
              <Button
                size="xs"
                variant="default"
                onClick={() => setSearchParams((prev) => withPage(prev, 1))}
              >
                Ir para a primeira página
              </Button>
            )}
          </Stack>
        </Card>
      )}

      {list.isSuccess && list.data.data.length > 0 && (
        <Card p={0} pos="relative">
          <LoadingOverlay visible={list.isPlaceholderData} />
          <Table.ScrollContainer minWidth={900}>
            <Table horizontalSpacing="md">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Fornecedor</Table.Th>
                  <Table.Th>Nota fiscal</Table.Th>
                  <Table.Th ta="right">Valor</Table.Th>
                  <Table.Th>Vencimento</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Solicitante</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {list.data.data.map((item) => (
                  <RequestRow key={item.id} item={item} />
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          <Group justify="space-between" p="md">
            <Text size="sm" c={palette.textSecondary}>
              {list.data.total} solicitaç{list.data.total === 1 ? 'ão' : 'ões'}
            </Text>
            {list.data.total_pages > 1 && (
              <Pagination
                total={list.data.total_pages}
                value={filters.page}
                onChange={(page) => setSearchParams((prev) => withPage(prev, page))}
                aria-label="Paginação"
              />
            )}
          </Group>
        </Card>
      )}
    </Stack>
  );
}
