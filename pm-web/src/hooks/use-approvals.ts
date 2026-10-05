"use client";

import { useQuery } from "@tanstack/react-query";
import { getPendingApprovalCount, getPendingApprovals } from "@/lib/approvals";
import { queryKeys } from "@/lib/query-keys";

/** Badge count for "Menunggu Persetujuan" (polled every 60 s). */
export function usePendingApprovalCount() {
  return useQuery({
    queryKey: queryKeys.approvalsCount,
    queryFn: ({ signal }) => getPendingApprovalCount(signal),
    refetchInterval: 60 * 1000,
  });
}

export function usePendingApprovals() {
  return useQuery({
    queryKey: queryKeys.approvalsPending,
    queryFn: ({ signal }) => getPendingApprovals(signal),
    refetchInterval: 60 * 1000,
  });
}
