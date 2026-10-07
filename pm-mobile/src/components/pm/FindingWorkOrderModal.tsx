import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { errorMessage } from '@/lib/api';
import { lookupApi } from '@/lib/endpoints';
import { queryKeys } from '@/lib/queryClient';
import { colors, PRIORITY_OPTIONS, priorityTones } from '@/lib/theme';
import type { PmFindingWorkOrderBody, Priority } from '@/lib/types';
import { Button, ChipGroup, FieldError, FieldLabel, ModalSheet, Segmented, TextField } from '../ui';

interface FindingWorkOrderModalProps {
  visible: boolean;
  /** Executor unit of the PM task (default target of the work order). */
  taskUnitId: number;
  equipmentLabel: string | null;
  /** Prefilled "Temuan PM {number}: {item} — {notes}". */
  defaultDescription: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: (body: PmFindingWorkOrderBody) => void;
}

/** "Buat WO dari temuan": raises a work order from a not-OK checklist item. */
export function FindingWorkOrderModal({
  visible,
  taskUnitId,
  equipmentLabel,
  defaultDescription,
  loading,
  onClose,
  onSubmit,
}: FindingWorkOrderModalProps) {
  const units = useQuery({
    queryKey: queryKeys.executorUnits,
    queryFn: lookupApi.executorUnits,
    enabled: visible,
    staleTime: 5 * 60_000,
  });

  const [unitId, setUnitId] = useState<number | null>(taskUnitId);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [priority, setPriority] = useState<Priority>('medium');
  const [description, setDescription] = useState(defaultDescription);
  const [errors, setErrors] = useState<{ unit?: string; category?: string; description?: string }>({});

  // Reset each time the modal opens.
  useEffect(() => {
    if (!visible) return;
    setUnitId(taskUnitId);
    setCategoryId(null);
    setPriority('medium');
    setDescription(defaultDescription);
    setErrors({});
  }, [visible, taskUnitId, defaultDescription]);

  // Fall back to the first unit when the task unit does not accept work orders.
  useEffect(() => {
    if (!visible || !units.data?.length) return;
    if (!units.data.some((u) => u.id === unitId)) setUnitId(units.data[0].id);
  }, [visible, units.data, unitId]);

  const unit = useMemo(() => units.data?.find((u) => u.id === unitId) ?? null, [units.data, unitId]);
  const category = unit?.categories.find((c) => c.id === categoryId) ?? null;

  const submit = () => {
    const e: typeof errors = {};
    if (!unitId) e.unit = 'Pilih unit pelaksana.';
    if (!categoryId) e.category = 'Pilih kategori pekerjaan.';
    if (!description.trim()) e.description = 'Uraian permintaan wajib diisi.';
    setErrors(e);
    if (Object.keys(e).length || !categoryId) return;
    onSubmit({
      service_category_id: categoryId,
      priority,
      // Only sent when it differs from the task unit (the server defaults to it).
      executor_unit_id: unitId && unitId !== taskUnitId ? unitId : undefined,
      request_description: description.trim(),
    });
  };

  return (
    <ModalSheet
      visible={visible}
      title="Buat WO dari Temuan"
      onClose={onClose}
      footer={
        <>
          <Button title="Batal" variant="secondary" onPress={onClose} style={{ flex: 1 }} disabled={loading} />
          <Button title="Buat WO" icon="construct-outline" onPress={submit} loading={loading} style={{ flex: 1.4 }} />
        </>
      }
    >
      {!!equipmentLabel && (
        <Text style={{ fontSize: 15, color: colors.textMuted }}>
          Alat & lokasi diisi otomatis: <Text style={{ fontWeight: '700', color: colors.text }}>{equipmentLabel}</Text>
        </Text>
      )}

      {units.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
      ) : units.isError ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.danger, fontSize: 15 }}>{errorMessage(units.error)}</Text>
          <Button title="Coba Lagi" variant="secondary" onPress={() => void units.refetch()} />
        </View>
      ) : (
        <>
          <View style={{ gap: 8 }}>
            <FieldLabel required>Unit Pelaksana</FieldLabel>
            <ChipGroup
              options={(units.data ?? []).map((u) => ({ value: u.id, label: u.display_name }))}
              value={unitId}
              onChange={(v) => {
                if (v === unitId) return;
                setUnitId(v);
                setCategoryId(null);
              }}
            />
            <FieldError message={errors.unit} />
          </View>
          <View style={{ gap: 8 }}>
            <FieldLabel required>Kategori</FieldLabel>
            {unit?.categories.length ? (
              <ChipGroup
                options={unit.categories.map((c) => ({ value: c.id, label: c.name }))}
                value={categoryId}
                onChange={setCategoryId}
              />
            ) : (
              <Text style={{ fontSize: 15, color: colors.textSubtle }}>Unit ini belum memiliki kategori.</Text>
            )}
            <FieldError message={errors.category} />
            {category?.requires_note && (
              <Text style={{ fontSize: 13, color: colors.textSubtle }}>
                Kategori ini memerlukan keterangan — tuliskan jenis pekerjaannya pada uraian di bawah.
              </Text>
            )}
          </View>
        </>
      )}

      <View style={{ gap: 8 }}>
        <FieldLabel required>Prioritas</FieldLabel>
        <Segmented
          options={PRIORITY_OPTIONS.map((p) => ({ ...p, color: priorityTones[p.value].fg }))}
          value={priority}
          onChange={setPriority}
        />
      </View>

      <TextField
        label="Permintaan Pekerjaan"
        required
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        error={errors.description}
      />
    </ModalSheet>
  );
}
