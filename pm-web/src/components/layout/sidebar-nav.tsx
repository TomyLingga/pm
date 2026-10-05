"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ClipboardList, FilePlus2, FileSignature, FileText, Inbox, Wrench } from "lucide-react";
import { usePendingApprovalCount } from "@/hooks/use-approvals";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: (path: string) => boolean;
  badge?: "approvals";
}

const isUnder = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Work Order",
    items: [
      {
        href: "/work-orders",
        label: "Work Order",
        icon: ClipboardList,
        isActive: (path) => isUnder(path, "/work-orders") && path !== "/work-orders/new",
      },
      {
        href: "/work-orders/new",
        label: "Buat WO",
        icon: FilePlus2,
        isActive: (path) => path === "/work-orders/new",
      },
    ],
  },
  {
    title: "Form Request",
    items: [
      {
        href: "/requests",
        label: "Form Request",
        icon: FileText,
        isActive: (path) => isUnder(path, "/requests") && path !== "/requests/new",
      },
      {
        href: "/requests/new",
        label: "Buat Request",
        icon: FileSignature,
        isActive: (path) => path === "/requests/new",
      },
    ],
  },
  {
    title: "Persetujuan",
    items: [
      {
        href: "/approvals",
        label: "Menunggu Persetujuan",
        icon: Inbox,
        isActive: (path) => isUnder(path, "/approvals"),
        badge: "approvals",
      },
    ],
  },
];

export function Brand() {
  return (
    <Link href="/work-orders" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Wrench className="h-5 w-5" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-bold">PM-App</span>
        <span className="block text-xs text-muted-foreground">PT Industri Nabati Lestari</span>
      </span>
    </Link>
  );
}

function CountBadge({ count, active }: { count: number; active: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none",
        active ? "bg-primary-foreground text-primary" : "bg-destructive text-destructive-foreground",
      )}
      aria-label={`${count} menunggu`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const approvals = usePendingApprovalCount();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b px-4">
        <Brand />
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto p-3" aria-label="Menu utama">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1">
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </p>
            {group.items.map((item) => {
              const active = item.isActive(pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/80 hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="truncate">{item.label}</span>
                  {item.badge === "approvals" ? <CountBadge count={approvals.data ?? 0} active={active} /> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <p className="border-t px-4 py-3 text-xs text-muted-foreground">FM-BOPS-10/05 &middot; INLHO/BSIS-ITC/F-004</p>
    </div>
  );
}
