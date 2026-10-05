import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

import { RequestForm } from '@/components/request/RequestForm';
import { ErrorView, LoadingView } from '@/components/ui';
import { useServiceRequest } from '@/hooks/useServiceRequest';
import { errorMessage } from '@/lib/api';

export default function EditRequestScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const query = useServiceRequest(id);

  if (query.isLoading) return <LoadingView />;
  if (!query.data) return <ErrorView message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  if (!query.data.permissions?.can_update) {
    return (
      <ErrorView
        message="Form Request ini tidak dapat diubah (hanya draft milik Anda yang bisa diubah)."
        onRetry={() => router.back()}
        retryLabel="Kembali"
      />
    );
  }
  return <RequestForm initial={query.data} />;
}
