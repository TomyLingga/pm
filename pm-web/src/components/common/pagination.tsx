"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PaginationMeta } from "@/types/api";

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  disabled?: boolean;
}

export function Pagination({ meta, onPageChange, itemLabel = "data", disabled }: PaginationProps) {
  const { current_page: page, last_page: lastPage, total, from, to } = meta;

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted-foreground">
        {total > 0 ? (
          <>
            Menampilkan <span className="font-medium text-foreground">{from ?? 0}</span>&ndash;
            <span className="font-medium text-foreground">{to ?? 0}</span> dari{" "}
            <span className="font-medium text-foreground">{total.toLocaleString("id-ID")}</span> {itemLabel}
          </>
        ) : (
          `0 ${itemLabel}`
        )}
      </p>
      {lastPage > 1 ? (
        <nav className="flex items-center gap-2" aria-label="Paginasi">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={disabled || page <= 1}
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft />
            <span className="hidden sm:inline">Sebelumnya</span>
          </Button>
          <span className="min-w-[6rem] text-center text-sm">
            Hal. {page} / {lastPage}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={disabled || page >= lastPage}
            aria-label="Halaman berikutnya"
          >
            <span className="hidden sm:inline">Berikutnya</span>
            <ChevronRight />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
