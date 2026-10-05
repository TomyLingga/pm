"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getWorkOrder } from "@/lib/work-orders";

export function useWorkOrder(id: number | null) {
  return useQuery({
    queryKey: queryKeys.workOrder(id ?? 0),
    queryFn: ({ signal }) => getWorkOrder(id as number, signal),
    enabled: id !== null,
  });
}
