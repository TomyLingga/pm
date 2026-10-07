"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { EmptyState } from "@/components/common/states";
import { useCurrentUser } from "@/components/layout/current-user";
import { Button } from "@/components/ui/button";
import { canAccessPm } from "@/lib/auth";

/**
 * Preventive Maintenance and the equipment master are only for executor-unit staff, admin and
 * management. The API enforces this as well; the guard just avoids showing empty/forbidden pages.
 */
export function PmAccessGuard({ children }: { children: React.ReactNode }) {
  const me = useCurrentUser();

  if (!canAccessPm(me)) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-5 w-5" aria-hidden />}
        title="Halaman ini khusus unit pelaksana"
        description="Preventive Maintenance dan data equipment hanya dapat diakses staf unit pelaksana, admin, dan manajemen."
        action={
          <Button asChild variant="outline">
            <Link href="/work-orders">Ke Work Order</Link>
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}
