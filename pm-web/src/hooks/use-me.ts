"use client";

import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/lib/auth";
import { queryKeys } from "@/lib/query-keys";

/** Current user (`GET /auth/me`). A 401 redirects to the Portal from inside the API client. */
export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => getMe(signal),
    staleTime: 5 * 60 * 1000,
  });
}
