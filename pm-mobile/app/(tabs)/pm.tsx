import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/auth/AuthContext';
import { PmTaskList } from '@/components/pm/PmTaskList';
import { Segmented } from '@/components/ui';
import { usePmSummary } from '@/hooks/usePmTask';
import { colors } from '@/lib/theme';
import type { PmTaskScope } from '@/lib/types';

type Scope = Extract<PmTaskScope, 'mine' | 'unit'>;

const withCount = (label: string, count: number | undefined) => (count && count > 0 ? `${label} (${count})` : label);

/** "PM" tab: preventive-maintenance tasks where I am the PIC, or all tasks of my executor unit. */
export default function PmScreen() {
  const { status, isExecutor } = useAuth();
  const [scope, setScope] = useState<Scope>('mine');
  const summary = usePmSummary(status === 'signedIn' && isExecutor);
  const mine = summary.data?.mine;
  const unit = summary.data?.unit;

  const switcher = (
    <View style={styles.switcher}>
      <Segmented<Scope>
        options={[
          { value: 'mine', label: withCount('Tugas Saya', mine ? mine.due + mine.overdue : undefined) },
          { value: 'unit', label: withCount('Unit', unit ? unit.due + unit.overdue : undefined) },
        ]}
        value={scope}
        onChange={setScope}
      />
    </View>
  );

  // `key` resets the filters/search when switching scope.
  return <PmTaskList key={scope} scope={scope} header={switcher} />;
}

const styles = StyleSheet.create({
  switcher: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.bg },
});
