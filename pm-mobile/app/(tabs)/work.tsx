import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Segmented } from '@/components/ui';
import { WorkOrderList, type ListFilter } from '@/components/WorkOrderList';
import { colors } from '@/lib/theme';

// The pool only contains WOs that have not been taken yet (status `submitted`),
// so filtering by status is meaningless there; priority chips are offered instead.
const POOL_FILTERS: ListFilter[] = [
  { key: 'all', label: 'Semua' },
  { key: 'high', label: 'Tinggi', priority: 'high' },
  { key: 'medium', label: 'Menengah', priority: 'medium' },
  { key: 'low', label: 'Rendah', priority: 'low' },
];

const ASSIGNED_FILTERS: ListFilter[] = [
  { key: 'active', label: 'Aktif', status: 'received,in_progress' },
  { key: 'all', label: 'Semua' },
  { key: 'received', label: 'Diterima', status: 'received' },
  { key: 'in_progress', label: 'Dikerjakan', status: 'in_progress' },
  { key: 'completed', label: 'Selesai', status: 'completed' },
  { key: 'closed', label: 'Closed', status: 'closed' },
];

type Kind = 'pool' | 'assigned';

/**
 * "WO" tab for executor-unit staff: the unit pool (scope=pool) and my assignments
 * (scope=assigned) behind one segmented switch, which keeps the tab bar at five tabs.
 */
export default function WorkScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<Kind>(params.kind === 'assigned' ? 'assigned' : 'pool');

  useEffect(() => {
    if (params.kind === 'pool' || params.kind === 'assigned') setKind(params.kind);
  }, [params.kind]);

  const switcher = (
    <View style={styles.switcher}>
      <Segmented
        options={[
          { value: 'pool', label: 'Pool' },
          { value: 'assigned', label: 'Tugas Saya' },
        ]}
        value={kind}
        onChange={setKind}
      />
    </View>
  );

  return kind === 'pool' ? (
    <WorkOrderList
      key="pool"
      scope="pool"
      filters={POOL_FILTERS}
      header={switcher}
      emptyTitle="Tidak ada WO di pool"
      emptyMessage="Semua WO untuk unit Anda sudah diambil atau ditugaskan. Tarik ke bawah untuk memuat ulang."
    />
  ) : (
    <WorkOrderList
      key="assigned"
      scope="assigned"
      filters={ASSIGNED_FILTERS}
      defaultFilterKey="active"
      header={switcher}
      emptyTitle="Belum ada tugas"
      emptyMessage="WO yang ditugaskan atau Anda ambil akan muncul di sini."
    />
  );
}

const styles = StyleSheet.create({
  switcher: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.bg },
});
