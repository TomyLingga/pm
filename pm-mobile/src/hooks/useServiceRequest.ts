import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { requestApi } from '@/lib/endpoints';
import { queryKeys } from '@/lib/queryClient';
import type { ServiceRequestDetail } from '@/lib/types';

export function useServiceRequest(id: number) {
  return useQuery({
    queryKey: queryKeys.request(id),
    queryFn: () => requestApi.get(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

function isRequestDetail(value: unknown): value is ServiceRequestDetail {
  return !!value && typeof value === 'object' && 'id' in value && 'permissions' in value && 'approval_steps' in value;
}

/**
 * After any Form Request action: replace the cached detail with the returned one (or refetch)
 * and invalidate request lists, pending approvals and work orders (conversions create WOs).
 */
export function applyRequestResult(qc: QueryClient, id: number, result: unknown): ServiceRequestDetail | null {
  const detail = isRequestDetail(result) ? result : null;
  if (detail) qc.setQueryData(queryKeys.request(id), detail);
  else void qc.invalidateQueries({ queryKey: queryKeys.request(id) });
  void qc.invalidateQueries({ queryKey: queryKeys.requests });
  void qc.invalidateQueries({ queryKey: queryKeys.approvals });
  void qc.invalidateQueries({ queryKey: queryKeys.workOrders });
  return detail;
}

export function useRequestAction<TVars = void>(id: number, fn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      applyRequestResult(qc, id, result);
    },
  });
}
