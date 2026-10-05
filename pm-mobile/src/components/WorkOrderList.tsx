import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';

import { workOrderApi } from '@/lib/endpoints';
import type { WorkOrderListItem, WorkOrderScope } from '@/lib/types';
import { PagedList, type ListFilter } from './PagedList';
import { WorkOrderCard } from './WorkOrderCard';

export type { ListFilter } from './PagedList';

interface WorkOrderListProps {
  scope: WorkOrderScope;
  filters: ListFilter[];
  defaultFilterKey?: string;
  emptyTitle: string;
  emptyMessage?: string;
  header?: React.ReactNode;
}

export function WorkOrderList({ scope, filters, defaultFilterKey, emptyTitle, emptyMessage, header }: WorkOrderListProps) {
  const router = useRouter();
  const openDetail = useCallback((id: number) => router.push(`/work-orders/${id}`), [router]);

  return (
    <PagedList<WorkOrderListItem>
      queryKey={['work-orders', scope]}
      fetchPage={(args) => workOrderApi.list({ scope, ...args })}
      renderItem={(item) => <WorkOrderCard item={item} onPress={openDetail} />}
      filters={filters}
      defaultFilterKey={defaultFilterKey}
      searchPlaceholder="Cari no. WO, permintaan, alat…"
      emptyTitle={emptyTitle}
      emptyMessage={emptyMessage}
      totalLabel="Work Order"
      fab={{ label: 'Buat WO', onPress: () => router.push('/work-orders/new') }}
      header={header}
    />
  );
}
