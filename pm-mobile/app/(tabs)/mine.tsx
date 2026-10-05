import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RequestList } from '@/components/RequestList';
import { Segmented } from '@/components/ui';
import { WorkOrderList, type ListFilter } from '@/components/WorkOrderList';
import { colors } from '@/lib/theme';

const WO_FILTERS: ListFilter[] = [
  { key: 'all', label: 'Semua' },
  { key: 'submitted', label: 'Diajukan', status: 'submitted' },
  { key: 'received', label: 'Diterima', status: 'received' },
  { key: 'in_progress', label: 'Dikerjakan', status: 'in_progress' },
  { key: 'completed', label: 'Perlu Konfirmasi', status: 'completed' },
  { key: 'closed', label: 'Closed', status: 'closed' },
  { key: 'cancelled', label: 'Dibatalkan', status: 'cancelled' },
  { key: 'converted', label: 'Dialihkan', status: 'converted' },
];

type Kind = 'wo' | 'request';

/** "Pengajuan" tab: my Work Orders and my Form Requests behind a simple switch. */
export default function MineScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const [kind, setKind] = useState<Kind>(params.kind === 'request' ? 'request' : 'wo');

  useEffect(() => {
    if (params.kind === 'request' || params.kind === 'wo') setKind(params.kind);
  }, [params.kind]);

  const switcher = (
    <View style={styles.switcher}>
      <Segmented
        options={[
          { value: 'wo', label: 'Work Order' },
          { value: 'request', label: 'Form Request' },
        ]}
        value={kind}
        onChange={setKind}
      />
    </View>
  );

  return kind === 'wo' ? (
    <WorkOrderList
      scope="mine"
      filters={WO_FILTERS}
      header={switcher}
      emptyTitle="Belum ada WO"
      emptyMessage='Ketuk "Buat WO" untuk mengajukan permintaan pekerjaan ke unit support.'
    />
  ) : (
    <RequestList scope="mine" header={switcher} />
  );
}

const styles = StyleSheet.create({
  switcher: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.bg },
});
