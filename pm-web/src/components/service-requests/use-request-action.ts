"use client";

import { useQuery } from "@tanstack/react-query";
import { useDocumentAction } from "@/hooks/use-document-action";
import { queryKeys } from "@/lib/query-keys";
import { getServiceRequest } from "@/lib/service-requests";
import type { ServiceRequestDetail } from "@/types/service-request";

export function useServiceRequest(id: number | null) {
  return useQuery({
    queryKey: queryKeys.serviceRequest(id ?? 0),
    queryFn: ({ signal }) => getServiceRequest(id as number, signal),
    enabled: id !== null,
  });
}

/** Form Request action: updates the cached detail; refreshes lists and the approval inbox. */
export function useRequestAction<TVariables = void>(
  requestId: number,
  action: (variables: TVariables) => Promise<ServiceRequestDetail | null>,
  options: { successMessage: string; onSuccess?: (detail: ServiceRequestDetail | null) => void },
) {
  return useDocumentAction<ServiceRequestDetail, TVariables>(action, {
    detailKey: queryKeys.serviceRequest(requestId),
    invalidate: [queryKeys.serviceRequestLists, queryKeys.approvals],
    ...options,
  });
}
