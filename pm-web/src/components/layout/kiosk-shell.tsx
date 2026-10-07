"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Maximize2, Minimize2 } from "lucide-react";
import { ErrorState } from "@/components/common/states";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useMe } from "@/hooks/use-me";
import { ApiError, errorMessage } from "@/lib/api";
import { CurrentUserProvider } from "./current-user";

const clockFormat = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

function Clock() {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!now) return <span className="tabular text-lg font-semibold">--:--:--</span>;
  return (
    <span className="text-right leading-tight">
      <span className="tabular block text-lg font-semibold">{timeFormat.format(now)}</span>
      <span className="block text-xs text-muted-foreground">{clockFormat.format(now)}</span>
    </span>
  );
}

function FullscreenButton() {
  const [active, setActive] = React.useState(false);
  React.useEffect(() => {
    const onChange = () => setActive(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };
  return (
    <Button variant="outline" size="sm" onClick={toggle} aria-label={active ? "Keluar dari layar penuh" : "Layar penuh"}>
      {active ? <Minimize2 aria-hidden /> : <Maximize2 aria-hidden />}
      <span className="hidden sm:inline">{active ? "Keluar layar penuh" : "Layar penuh"}</span>
    </Button>
  );
}

/** Wall-display layout: no sidebar, a slim bar with clock + fullscreen, content fills the viewport. */
export function KioskShell({ title, children }: { title: string; children: React.ReactNode }) {
  const me = useMe();

  if (me.isPending) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Spinner label="Memuat…" />
      </div>
    );
  }
  if (me.isError) {
    const unauthorized = me.error instanceof ApiError && me.error.status === 401;
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-4">
        {unauthorized ? <Spinner label="Sesi berakhir, mengalihkan ke Portal…" /> : <ErrorState className="w-full max-w-md" message={errorMessage(me.error)} onRetry={() => me.refetch()} />}
      </div>
    );
  }

  return (
    <CurrentUserProvider user={me.data}>
      <div className="flex h-[100dvh] flex-col bg-background">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- static logo from /public */}
          <img src="/logo.png" alt="" width={36} height={36} className="h-9 w-9 rounded-full" aria-hidden />
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>
            <p className="truncate text-xs text-muted-foreground">PrevenTech · PT Industri Nabati Lestari</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Clock />
            <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
            <ThemeToggle />
            <FullscreenButton />
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard" aria-label="Kembali ke dashboard">
                <ArrowLeft aria-hidden />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            </Button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:overflow-hidden">{children}</main>
      </div>
    </CurrentUserProvider>
  );
}
