"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { ApiError, errorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export interface DocumentActionOptions<TResult> {
  /** Cache key of the document detail. */
  detailKey: QueryKey;
  /** Extra keys to invalidate after success (lists, counters, ...). */
  invalidate?: QueryKey[];
  successMessage: string;
  onSuccess?: (result: TResult | null) => void;
}

/**
 * Mutation for a document action. The server answers with the updated detail, which replaces
 * the cached detail; when it does not, the detail is refetched instead. 422 errors are left to
 * the caller (shown inline); other errors become a toast.
 */
export function useDocumentAction<TResult, TVariables = void>(
  action: (variables: TVariables) => Promise<TResult | null>,
  { detailKey, invalidate = [], successMessage, onSuccess }: DocumentActionOptions<TResult>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: action,
    onSuccess: (result) => {
      if (result) {
        queryClient.setQueryData(detailKey, result);
      } else {
        void queryClient.invalidateQueries({ queryKey: detailKey });
      }
      for (const key of [...invalidate, queryKeys.notifications]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      toast.success(successMessage);
      onSuccess?.(result);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422) return;
      toast.error(errorMessage(error));
      // 409/403 = state changed elsewhere: refresh so the action bar matches the server.
      if (error instanceof ApiError && (error.status === 409 || error.status === 403)) {
        void queryClient.invalidateQueries({ queryKey: detailKey });
      }
    },
  });
}
