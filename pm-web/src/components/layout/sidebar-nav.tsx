"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  CalendarCheck2,
  Smartphone,
  CalendarClock,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Cog,
  FilePlus2,
  FileSignature,
  FileText,
  Inbox,
  LayoutDashboard,
  ListTodo,
  ListChecks,
  MonitorPlay,
  ShieldCheck,
  Tags,
} from "lucide-react";
import { usePendingApprovalCount } from "@/hooks/use-approvals";
import { usePmTaskSummary } from "@/hooks/use-pm";
import { canAccessPm, isAdmin } from "@/lib/auth";
import { PM_TASKS_DEFAULT_HREF } from "@/lib/pm-constants";
import { cn } from "@/lib/utils";
import type { Me } from "@/types/auth";
import { useCurrentUser } from "./current-user";

type BadgeKey = "approvals" | "pm_tasks";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: (path: string) => boolean;
  badge?: BadgeKey;
  visible?: (me: Me) => boolean;
}

interface NavGroup {
  key: string;
  title: string;
  icon: LucideIcon;
  items: NavItem[];
  visible?: (me: Me) => boolean;
}

const STORAGE_KEY = "pm-sidebar-groups";

const isUnder = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

const HOME: NavItem = {
  href: "/dashboard",
  label: "Dashboard",
  icon: LayoutDashboard,
  isActive: (path) => isUnder(path, "/dashboard"),
};

const MONITOR: NavItem = {
  href: "/monitor",
  label: "Papan Monitor",
  icon: MonitorPlay,
  isActive: (path) => isUnder(path, "/monitor"),
};

const NAV_GROUPS: NavGroup[] = [
  {
    key: "work-orders",
    title: "Work Order",
    icon: ClipboardList,
    items: [
      {
        href: "/work-orders",
        label: "Daftar Work Order",
        icon: ClipboardList,
        isActive: (path) => isUnder(path, "/work-orders") && path !== "/work-orders/new",
      },
      { href: "/work-orders/new", label: "Buat WO", icon: FilePlus2, isActive: (path) => path === "/work-orders/new" },
    ],
  },
  {
    key: "requests",
    title: "Form Request",
    icon: FileText,
    items: [
      {
        href: "/requests",
        label: "Daftar Request",
        icon: FileText,
        isActive: (path) => isUnder(path, "/requests") && path !== "/requests/new",
      },
      { href: "/requests/new", label: "Buat Request", icon: FileSignature, isActive: (path) => path === "/requests/new" },
    ],
  },
  {
    key: "approvals",
    title: "Persetujuan",
    icon: Inbox,
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
  {
    key: "pm",
    title: "Preventive Maintenance",
    icon: ClipboardCheck,
    visible: canAccessPm,
    items: [
      {
        href: PM_TASKS_DEFAULT_HREF,
        label: "Tugas PM",
        icon: ClipboardCheck,
        isActive: (path) => isUnder(path, "/pm/tasks"),
        badge: "pm_tasks",
      },
      { href: "/pm/calendar", label: "Kalender PM", icon: CalendarDays, isActive: (path) => isUnder(path, "/pm/calendar") },
      { href: "/pm/schedules", label: "Jadwal PM", icon: CalendarClock, isActive: (path) => isUnder(path, "/pm/schedules") },
      { href: "/pm/templates", label: "Template Checklist", icon: ListChecks, isActive: (path) => isUnder(path, "/pm/templates") },
      { href: "/equipment", label: "Equipment", icon: Cog, isActive: (path) => isUnder(path, "/equipment") },
    ],
  },
  {
    key: "programs",
    title: "Program & Aktivitas",
    icon: ListTodo,
    items: [
      { href: "/programs", label: "Program Kerja Tahunan", icon: ListTodo, isActive: (path) => isUnder(path, "/programs") },
      { href: "/activities", label: "Aktivitas Harian", icon: CalendarCheck2, isActive: (path) => isUnder(path, "/activities") },
    ],
  },
  {
    key: "settings",
    title: "Pengaturan",
    icon: Cog,
    items: [
      { href: "/settings/categories", label: "Kategori Layanan", icon: Tags, isActive: (path) => isUnder(path, "/settings/categories") },
      { href: "/settings/notifications", label: "Notifikasi", icon: Bell, isActive: (path) => isUnder(path, "/settings/notifications") },
      {
        href: "/settings/access",
        label: "Hak Akses",
        icon: ShieldCheck,
        isActive: (path) => isUnder(path, "/settings/access"),
        visible: isAdmin,
      },
      {
        href: "/settings/mobile-app",
        label: "Aplikasi Mobile",
        icon: Smartphone,
        isActive: (path) => isUnder(path, "/settings/mobile-app"),
        visible: isAdmin,
      },
    ],
  },
];

function readOpenState(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function Brand() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static logo from /public */}
      <img src="/logo.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full" aria-hidden />
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-tight">PrevenTech</span>
        <span className="block text-[11px] text-muted-foreground">PT Industri Nabati Lestari</span>
      </span>
    </Link>
  );
}

function CountBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <span
      className="tabular ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold leading-none text-danger-on-solid"
      aria-label={`${count} ${label}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavLink({
  item,
  active,
  badge,
  nested,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  badge?: { count: number; label: string };
  nested?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 items-center gap-2.5 rounded-md pr-2 text-sm transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-8 md:text-[13px]",
        nested ? "pl-3" : "pl-2.5",
        active
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
      )}
    >
      {active ? (
        <span className="absolute -left-px top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" aria-hidden />
      ) : null}
      <Icon
        className={cn("h-4 w-4 shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")}
        aria-hidden
      />
      <span className="truncate">{item.label}</span>
      {badge ? <CountBadge count={badge.count} label={badge.label} /> : null}
    </Link>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const me = useCurrentUser();
  const pmVisible = canAccessPm(me);
  const approvals = usePendingApprovalCount();
  const pmSummary = usePmTaskSummary(pmVisible);
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setOpen(readOpenState());
    setHydrated(true);
  }, []);

  const groups = React.useMemo(
    () =>
      NAV_GROUPS.filter((group) => !group.visible || group.visible(me)).map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.visible || item.visible(me)),
      })),
    [me],
  );
  const activeGroupKey = groups.find((group) => group.items.some((item) => item.isActive(pathname)))?.key ?? null;

  const isOpen = (key: string) => key === activeGroupKey || (open[key] ?? true);
  const toggle = (key: string) => {
    const next = { ...open, [key]: !isOpen(key) };
    setOpen(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage blocked */
    }
  };

  const badges: Record<BadgeKey, { count: number; label: string }> = {
    approvals: { count: approvals.data ?? 0, label: "menunggu persetujuan" },
    // Tasks of mine that are due or past tolerance.
    pm_tasks: {
      count: (pmSummary.data?.mine?.due ?? 0) + (pmSummary.data?.mine?.overdue ?? 0),
      label: "tugas PM jatuh tempo/terlambat",
    },
  };
  const groupBadge = (group: NavGroup) =>
    group.items.reduce((sum, item) => sum + (item.badge ? badges[item.badge].count : 0), 0);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-4">
        <Brand />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3" aria-label="Menu utama">
        <NavLink item={HOME} active={HOME.isActive(pathname)} onNavigate={onNavigate} />
        <NavLink item={MONITOR} active={MONITOR.isActive(pathname)} onNavigate={onNavigate} />

        {groups.map((group) => {
          const expanded = isOpen(group.key);
          const collapsedCount = expanded ? 0 : groupBadge(group);
          const GroupIcon = group.icon;
          const panelId = `nav-group-${group.key}`;
          return (
            <div key={group.key} className="pt-0.5">
              <button
                type="button"
                onClick={() => toggle(group.key)}
                aria-expanded={expanded}
                aria-controls={panelId}
                className={cn(
                  "flex h-10 w-full items-center gap-2.5 rounded-md pl-2.5 pr-2 text-sm transition-[background-color,color] duration-150 hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-8 md:text-[13px]",
                  group.key === activeGroupKey ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                <GroupIcon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{group.title}</span>
                {collapsedCount > 0 ? <CountBadge count={collapsedCount} label="perlu tindakan" /> : null}
                <ChevronRight
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform duration-200 ease-out-expo",
                    collapsedCount > 0 ? "ml-1" : "ml-auto",
                    expanded && "rotate-90",
                  )}
                  aria-hidden
                />
              </button>
              <div
                id={panelId}
                className={cn(
                  "grid transition-[grid-template-rows] duration-200 ease-out-expo",
                  expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  !hydrated && "transition-none",
                )}
              >
                <div className="overflow-hidden">
                  <div className="relative ml-[1.15rem] mt-0.5 space-y-0.5 border-l border-sidebar-border pl-1.5">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.href}
                        item={item}
                        nested
                        active={item.isActive(pathname)}
                        badge={item.badge ? badges[item.badge] : undefined}
                        onNavigate={onNavigate}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border px-4 py-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          FM-BOPS-10/05 <span className="mx-1 text-border">|</span> INLHO/BSIS-ITC/F-004
        </p>
      </div>
    </div>
  );
}
