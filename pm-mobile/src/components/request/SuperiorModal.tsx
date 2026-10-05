import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { SearchPickerModal } from '@/components/SearchPickerModal';
import { lookupApi } from '@/lib/endpoints';
import { colors } from '@/lib/theme';
import type { SuperiorCandidate, UserBrief } from '@/lib/types';
import { Button, FieldError, ModalSheet, SelectField, TextField } from '../ui';

type Superior = (UserBrief & { grade_code?: string | null }) | null;

interface SuperiorModalProps {
  visible: boolean;
  mode: 'submit' | 'change';
  initialSuperior: Superior;
  loading: boolean;
  onClose: () => void;
  onSubmit: (superior: Superior, reason: string) => void;
}

/** "Ajukan" (confirm/choose superior) and "Ganti Atasan" (new superior + optional reason). */
export function SuperiorModal({ visible, mode, initialSuperior, loading, onClose, onSubmit }: SuperiorModalProps) {
  const [superior, setSuperior] = useState<Superior>(initialSuperior);
  const [reason, setReason] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (visible) {
      setSuperior(mode === 'change' ? null : initialSuperior);
      setReason('');
      setError(undefined);
    }
  }, [visible, mode, initialSuperior]);

  const submit = () => {
    if (mode === 'change' && !superior) {
      setError('Pilih atasan pengganti.');
      return;
    }
    if (mode === 'change' && superior && superior.id === initialSuperior?.id) {
      setError('Pilih atasan yang berbeda.');
      return;
    }
    onSubmit(superior, reason.trim());
  };

  return (
    <>
      <ModalSheet
        visible={visible && !pickerOpen}
        title={mode === 'submit' ? 'Ajukan Form Request' : 'Ganti Atasan'}
        onClose={onClose}
        footer={
          <>
            <Button title="Kembali" variant="secondary" onPress={onClose} style={{ flex: 1 }} disabled={loading} />
            <Button
              title={mode === 'submit' ? 'Ajukan' : 'Simpan'}
              icon={mode === 'submit' ? 'send' : 'checkmark'}
              onPress={submit}
              loading={loading}
              style={{ flex: 1.4 }}
            />
          </>
        }
      >
        <Text style={{ fontSize: 15, color: colors.textMuted }}>
          {mode === 'submit'
            ? 'Request akan dikirim ke atasan untuk disetujui, lalu ke pimpinan divisi pelaksana.'
            : `Atasan saat ini: ${initialSuperior?.name ?? '-'}. Persetujuan akan dialihkan ke atasan baru.`}
        </Text>
        <SelectField
          label={mode === 'submit' ? 'Atasan YBS' : 'Atasan pengganti'}
          required={mode === 'change'}
          value={superior?.name ?? null}
          subtitle={[superior?.nrk, superior?.position].filter(Boolean).join(' · ')}
          placeholder={mode === 'submit' ? 'Tanpa atasan (langkah atasan dilewati)' : 'Pilih atasan'}
          icon="person-circle-outline"
          onPress={() => setPickerOpen(true)}
          onClear={mode === 'submit' ? () => setSuperior(null) : undefined}
        />
        <FieldError message={error} />
        {mode === 'change' && (
          <TextField label="Alasan (opsional)" value={reason} onChangeText={setReason} multiline numberOfLines={3} />
        )}
      </ModalSheet>

      <SearchPickerModal<SuperiorCandidate>
        visible={visible && pickerOpen}
        title="Pilih Atasan"
        placeholder="Cari nama / NRK atasan"
        queryKey={['superior-candidates']}
        fetcher={(q) => lookupApi.superiorCandidates(q)}
        keyExtractor={(u) => String(u.id)}
        itemTitle={(u) => u.name}
        itemSubtitle={(u) => [u.nrk, u.position, u.grade_code].filter(Boolean).join(' · ')}
        onClose={() => setPickerOpen(false)}
        onSelect={(u) => {
          setSuperior(u);
          setError(undefined);
          setPickerOpen(false);
        }}
      />
    </>
  );
}
