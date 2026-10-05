import React from 'react';

import { WorkOrderList, type ListFilter } from '@/components/WorkOrderList';

// The pool only contains WOs that have not been taken yet (status `submitted`),
// so filtering by status is meaningless here; priority chips are offered instead.
const FILTERS: ListFilter[] = [
  { key: 'all', label: 'Semua' },
  { key: 'high', label: 'Tinggi', priority: 'high' },
  { key: 'medium', label: 'Menengah', priority: 'medium' },
  { key: 'low', label: 'Rendah', priority: 'low' },
];

export default function PoolScreen() {
  return (
    <WorkOrderList
      scope="pool"
      filters={FILTERS}
      emptyTitle="Tidak ada WO di pool"
      emptyMessage="Semua WO untuk unit Anda sudah diambil atau ditugaskan. Tarik ke bawah untuk memuat ulang."
    />
  );
}
