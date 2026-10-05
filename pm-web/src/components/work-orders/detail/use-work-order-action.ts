"use client";

import { useDocumentAction } from "@/hooks/use-document-action";
import { queryKeys } from "@/lib/query-keys";
import type { WorkOrderDetail } from "@/types/work-order";

export { firstError, unmatchedValidationMessage, validationErrors } from "@/lib/validation";

interface ActionOptions {
  successMessage: string;
  onSuccess?: (detail: WorkOrderDetail | null) => void;
}

/** WO action: updates the cached detail and refreshes WO lists. */
export function useWorkOrderAction<TVariables = void>(
  workOrderId: number,
  action: (variables: TVariables) => Promise<WorkOrderDetail | null>,
  { successMessage, onSuccess }: ActionOptions,
) {
  return useDocumentAction<WorkOrderDetail, TVariables>(action, {
    detailKey: queryKeys.workOrder(workOrderId),
    invalidate: [queryKeys.workOrderLists],
    successMessage,
    onSuccess,
  });
}
