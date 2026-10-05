import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';

import { requestApi } from '@/lib/endpoints';
import type { ServiceRequestListItem, ServiceRequestScope } from '@/lib/types';
import { PagedList, type ListFilter } from './PagedList';
import { RequestCard } from './RequestCard';

export const REQUEST_FILTERS: ListFilter[] = [
  { key: 'all', label: 'Semua' },
  { key: 'draft', label: 'Draft', status: 'draft' },
  { key: 'waiting', label: 'Menunggu', status: 'waiting_superior,waiting_executor' },
  { key: 'in_progress', label: 'Diproses', status: 'in_progress' },
  { key: 'completed', label: 'Selesai', status: 'completed' },
  { key: 'rejected', label: 'Ditolak', status: 'rejected' },
  { key: 'cancelled', label: 'Dibatalkan', status: 'cancelled' },
  { key: 'converted', label: 'Dialihkan', status: 'converted' },
];

export function RequestList({ scope, header }: { scope: ServiceRequestScope; header?: React.ReactNode }) {
  const router = useRouter();
  const openDetail = useCallback((id: number) => router.push(`/requests/${id}`), [router]);

  return (
    <PagedList<ServiceRequestListItem>
      queryKey={['service-requests', scope]}
      fetchPage={(args) => requestApi.list({ scope, ...args })}
      renderItem={(item) => <RequestCard item={item} onPress={openDetail} />}
      filters={REQUEST_FILTERS}
      searchPlaceholder="Cari no. request / keperluan…"
      emptyTitle="Belum ada Form Request"
      emptyMessage='Ketuk "Buat Request" untuk mengajukan permintaan yang memerlukan persetujuan (laptop, akses, dll).'
      totalLabel="Form Request"
      fab={{ label: 'Buat Request', onPress: () => router.push('/requests/new') }}
      header={header}
    />
  );
}
