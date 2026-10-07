import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';

import { pmTaskApi } from '@/lib/endpoints';
import type { PmTaskListItem, PmTaskScope } from '@/lib/types';
import { PagedList, type ListFilter } from '../PagedList';
import { PmTaskCard } from './PmTaskCard';

// Multi-select chips; by default the actionable statuses are active.
export const PM_FILTERS: ListFilter[] = [
  { key: 'all', label: 'Semua' },
  { key: 'due', label: 'Jatuh Tempo', status: 'due' },
  { key: 'overdue', label: 'Terlambat', status: 'overdue' },
  { key: 'in_progress', label: 'Dikerjakan', status: 'in_progress' },
  { key: 'scheduled', label: 'Terjadwal', status: 'scheduled' },
  { key: 'completed', label: 'Selesai', status: 'completed' },
  { key: 'skipped', label: 'Dilewati', status: 'skipped' },
];

export const PM_DEFAULT_FILTERS = ['due', 'overdue', 'in_progress'];

const FINAL_STATUSES = ['completed', 'skipped'];

/** Open tasks: soonest due first. Only finished ones selected: most recent first. */
function sortFor(status: string | undefined): 'due_at' | '-due_at' {
  if (!status) return 'due_at';
  return status.split(',').every((s) => FINAL_STATUSES.includes(s)) ? '-due_at' : 'due_at';
}

export function PmTaskList({ scope, header }: { scope: PmTaskScope; header?: React.ReactNode }) {
  const router = useRouter();
  const openDetail = useCallback((id: number) => router.push(`/pm-tasks/${id}`), [router]);

  return (
    <PagedList<PmTaskListItem>
      queryKey={['pm-tasks', scope]}
      fetchPage={({ page, status, q }) => pmTaskApi.list({ scope, status, q, page, sort: sortFor(status) })}
      renderItem={(item) => <PmTaskCard item={item} onPress={openDetail} />}
      filters={PM_FILTERS}
      multiple
      defaultFilterKeys={PM_DEFAULT_FILTERS}
      searchPlaceholder="Cari alat / jadwal…"
      emptyTitle="Tidak ada tugas PM"
      emptyMessage={
        scope === 'mine'
          ? 'Tidak ada tugas PM untuk Anda pada filter ini. Tarik ke bawah untuk memuat ulang.'
          : 'Tidak ada tugas PM unit Anda pada filter ini.'
      }
      totalLabel="tugas PM"
      header={header}
    />
  );
}
