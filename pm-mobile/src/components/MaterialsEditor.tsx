import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { lookupApi } from '@/lib/endpoints';
import { parseDecimal } from '@/lib/format';
import { colors, radius } from '@/lib/theme';
import type { MaterialInput, MaterialItem, WorkOrderMaterial } from '@/lib/types';
import { SearchPickerModal } from './SearchPickerModal';
import { Button, SelectField, TextField } from './ui';

/** One editable material line (used by the WO completion form and PM tasks). */
export interface MaterialRow {
  key: string;
  material_id: number | null;
  material_name: string;
  quantity: string;
  unit: string;
}

let rowSeq = 0;
const newRowKey = () => `mat-${Date.now()}-${rowSeq++}`;

export function newMaterialRow(): MaterialRow {
  return { key: newRowKey(), material_id: null, material_name: '', quantity: '', unit: '' };
}

export function materialRowsFrom(materials: WorkOrderMaterial[] | null | undefined): MaterialRow[] {
  return (materials ?? []).map((m) => ({
    key: newRowKey(),
    material_id: m.material_id,
    material_name: m.material_name,
    quantity: String(m.quantity ?? ''),
    unit: m.unit ?? '',
  }));
}

function isEmptyRow(r: MaterialRow) {
  return !r.material_name.trim() && !r.quantity.trim() && !r.unit.trim();
}

/**
 * Validates the rows (blank rows are ignored), writing messages into `errors` under
 * `m.{key}.name|qty|unit`, and returns the API payload for the valid rows.
 */
export function validateMaterials(rows: MaterialRow[], errors: Record<string, string>): MaterialInput[] {
  const out: MaterialInput[] = [];
  rows.forEach((r) => {
    if (isEmptyRow(r)) return;
    const qty = parseDecimal(r.quantity);
    if (!r.material_name.trim()) errors[`m.${r.key}.name`] = 'Nama material wajib diisi.';
    if (qty === null || qty <= 0) errors[`m.${r.key}.qty`] = 'Jumlah harus > 0.';
    if (!r.unit.trim()) errors[`m.${r.key}.unit`] = 'Satuan wajib.';
    if (r.material_name.trim() && qty !== null && qty > 0 && r.unit.trim()) {
      out.push({ material_id: r.material_id, material_name: r.material_name.trim(), quantity: qty, unit: r.unit.trim() });
    }
  });
  return out;
}

interface MaterialsEditorProps {
  rows: MaterialRow[];
  onChange: (rows: MaterialRow[]) => void;
  errors?: Record<string, string>;
}

/** Material rows: search `/materials?q=` or free text, quantity and unit. */
export function MaterialsEditor({ rows, onChange, errors = {} }: MaterialsEditorProps) {
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const update = (key: string, patch: Partial<MaterialRow>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <View style={styles.wrapper}>
      {rows.map((m, i) => (
        <View key={m.key} style={styles.rowCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.rowTitle}>Material {i + 1}</Text>
            <Pressable
              onPress={() => onChange(rows.filter((r) => r.key !== m.key))}
              hitSlop={10}
              style={styles.removeBtn}
              accessibilityLabel="Hapus material"
            >
              <Ionicons name="trash-outline" size={22} color={colors.danger} />
            </Pressable>
          </View>
          <SelectField
            value={m.material_name || null}
            subtitle={m.material_id ? 'Dari master material' : 'Isian bebas'}
            placeholder="Cari material / isi bebas"
            icon="cube-outline"
            onPress={() => setPickerFor(m.key)}
            error={errors[`m.${m.key}.name`]}
          />
          <View style={styles.inline}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Jumlah"
                value={m.quantity}
                onChangeText={(t) => update(m.key, { quantity: t })}
                keyboardType="decimal-pad"
                placeholder="0"
                error={errors[`m.${m.key}.qty`]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="Satuan"
                value={m.unit}
                onChangeText={(t) => update(m.key, { unit: t })}
                placeholder="pcs, m, liter"
                error={errors[`m.${m.key}.unit`]}
              />
            </View>
          </View>
        </View>
      ))}
      <Button title="Tambah Material" icon="add" variant="secondary" onPress={() => onChange([...rows, newMaterialRow()])} />

      <SearchPickerModal<MaterialItem>
        visible={!!pickerFor}
        title="Pilih Material"
        placeholder="Cari kode / nama material"
        queryKey={['materials']}
        fetcher={(q) => lookupApi.materials(q)}
        keyExtractor={(m) => String(m.id)}
        itemTitle={(m) => m.name}
        itemSubtitle={(m) => [m.code, m.unit].filter(Boolean).join(' · ')}
        onClose={() => setPickerFor(null)}
        onSelect={(m) => {
          if (pickerFor) update(pickerFor, { material_id: m.id, material_name: m.name, unit: m.unit ?? '' });
          setPickerFor(null);
        }}
        onFreeText={(text) => {
          if (pickerFor) update(pickerFor, { material_id: null, material_name: text });
          setPickerFor(null);
        }}
        freeTextLabel={(t) => `Gunakan material "${t}"`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 12 },
  rowCard: {
    gap: 10,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
  removeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  inline: { flexDirection: 'row', gap: 10 },
});
