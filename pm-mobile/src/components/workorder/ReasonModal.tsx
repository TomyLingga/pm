import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { colors } from '@/lib/theme';
import { Button, ModalSheet, TextField, type ButtonVariant } from '../ui';

interface ReasonModalProps {
  visible: boolean;
  title: string;
  message?: string;
  label: string;
  confirmLabel: string;
  loading: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  /** Whether the text is mandatory (default true). */
  required?: boolean;
  confirmVariant?: ButtonVariant;
  hint?: string;
  placeholder?: string;
  /** Extra controls rendered above the text field (e.g. an executor picker). */
  children?: React.ReactNode;
}

/** Modal asking for a reason / notes (cancel, reject, revision, approve, complete, convert…). */
export function ReasonModal({
  visible,
  title,
  message,
  label,
  confirmLabel,
  loading,
  onClose,
  onSubmit,
  required = true,
  confirmVariant = 'danger',
  hint,
  placeholder,
  children,
}: ReasonModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (visible) {
      setReason('');
      setError(undefined);
    }
  }, [visible]);

  const submit = () => {
    if (required && !reason.trim()) {
      setError(`${label} wajib diisi.`);
      return;
    }
    onSubmit(reason.trim());
  };

  return (
    <ModalSheet
      visible={visible}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button title="Kembali" variant="secondary" onPress={onClose} style={{ flex: 1 }} disabled={loading} />
          <Button title={confirmLabel} variant={confirmVariant} onPress={submit} loading={loading} style={{ flex: 1.4 }} />
        </>
      }
    >
      {message && <Text style={{ fontSize: 15, color: colors.textMuted }}>{message}</Text>}
      {children}
      <TextField
        label={label}
        required={required}
        value={reason}
        onChangeText={(t) => {
          setReason(t);
          if (error) setError(undefined);
        }}
        multiline
        numberOfLines={4}
        autoFocus={!children}
        placeholder={placeholder}
        hint={hint}
        error={error}
      />
    </ModalSheet>
  );
}
