import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { isWorkOrderDetail, lookupApi, workOrderApi } from '@/lib/endpoints';
import { queryKeys } from '@/lib/queryClient';
import type { WorkOrderDetail } from '@/lib/types';

export function useWorkOrder(id: number) {
  return useQuery({
    queryKey: queryKeys.workOrder(id),
    queryFn: () => workOrderApi.get(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

export function useStaff(executorUnitId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.staff(executorUnitId ?? 0),
    queryFn: () => lookupApi.staff(executorUnitId as number),
    enabled: enabled && !!executorUnitId,
    staleTime: 5 * 60_000,
  });
}

/** Extracts a WorkOrderDetail from either a bare detail or a `{ data }` envelope. */
function extractDetail(result: unknown): WorkOrderDetail | null {
  if (isWorkOrderDetail(result)) return result;
  if (result && typeof result === 'object' && 'data' in result) {
    const data = (result as { data: unknown }).data;
    if (isWorkOrderDetail(data)) return data;
  }
  return null;
}

/**
 * After any action: replace the cached detail with the returned one (or refetch when the
 * endpoint returned something else) and invalidate every list.
 */
export function applyWorkOrderResult(qc: QueryClient, id: number, result: unknown): WorkOrderDetail | null {
  const detail = extractDetail(result);
  if (detail) {
    qc.setQueryData(queryKeys.workOrder(id), detail);
  } else {
    void qc.invalidateQueries({ queryKey: queryKeys.workOrder(id) });
  }
  void qc.invalidateQueries({ queryKey: queryKeys.workOrders });
  // Conversions create/close Form Requests and may change pending approvals.
  void qc.invalidateQueries({ queryKey: queryKeys.requests });
  void qc.invalidateQueries({ queryKey: queryKeys.approvals });
  return detail;
}

export function useWorkOrderAction<TVars = void>(id: number, fn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      applyWorkOrderResult(qc, id, result);
    },
  });
}
