"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Tab (scope), filters and page kept in the URL so lists are shareable and survive reloads.
 * `scopes` is the list of scopes the user may see; an unknown/forbidden URL scope falls back to the first one.
 */
export function useUrlListState<K extends string, S extends string>(filterKeys: readonly K[], scopes: readonly S[]) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawScope = searchParams.get("scope");
  const scope = (rawScope && (scopes as readonly string[]).includes(rawScope) ? rawScope : scopes[0]) as S;

  const filters = React.useMemo(() => {
    const result = {} as Record<K, string>;
    for (const key of filterKeys) result[key] = searchParams.get(key) ?? "";
    return result;
  }, [filterKeys, searchParams]);

  const pageParam = Number(searchParams.get("page"));
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const replaceParams = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      mutate(next);
      for (const [key, value] of Array.from(next.entries())) {
        if (!value) next.delete(key);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  /** Patch filters (empty string removes); resets to page 1. */
  const setFilters = React.useCallback(
    (patch: Partial<Record<K, string>>) =>
      replaceParams((params) => {
        for (const [key, value] of Object.entries(patch) as Array<[string, string | undefined]>) {
          params.set(key, value ?? "");
        }
        params.delete("page");
      }),
    [replaceParams],
  );

  const setScope = React.useCallback(
    (next: S) =>
      replaceParams((params) => {
        params.set("scope", next);
        params.delete("page");
      }),
    [replaceParams],
  );

  const setPage = React.useCallback(
    (next: number) => replaceParams((params) => params.set("page", next > 1 ? String(next) : "")),
    [replaceParams],
  );

  const resetFilters = React.useCallback(
    () =>
      replaceParams((params) => {
        for (const key of filterKeys) params.delete(key);
        params.delete("page");
      }),
    [filterKeys, replaceParams],
  );

  const activeFilterCount = filterKeys.filter((key) => key !== "q" && filters[key]).length;

  return { scope, filters, page, activeFilterCount, setFilters, setScope, setPage, resetFilters };
}
