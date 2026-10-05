import React from 'react';

import { WorkOrderList, type ListFilter } from '@/components/WorkOrderList';

const FILTERS: ListFilter[] = [
  { key: 'active', label: 'Aktif', status: 'received,in_progress' },
  { key: 'all', label: 'Semua' },
  { key: 'received', label: 'Diterima', status: 'received' },
  { key: 'in_progress', label: 'Dikerjakan', status: 'in_progress' },
  { key: 'completed', label: 'Selesai', status: 'completed' },
  { key: 'closed', label: 'Closed', status: 'closed' },
];

export default function AssignedScreen() {
  return (
    <WorkOrderList
      scope="assigned"
      filters={FILTERS}
      defaultFilterKey="active"
      emptyTitle="Belum ada tugas"
      emptyMessage="WO yang ditugaskan atau Anda ambil akan muncul di sini."
    />
  );
}
