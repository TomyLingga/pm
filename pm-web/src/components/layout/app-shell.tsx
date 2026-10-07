"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { ErrorState } from "@/components/common/states";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useMe } from "@/hooks/use-me";
import { ApiError, errorMessage } from "@/lib/api";
import { CurrentUserProvider } from "./current-user";
import { NotificationBell } from "./notification-bell";
import { Brand, SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

export function AppShell({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = React.useState(false);

  // Close the mobile drawer whenever the route changes.
  React.useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  if (me.isPending) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Spinner label="Memuat profil…" />
      </div>
    );
  }

  if (me.isError) {
    const unauthorized = me.error instanceof ApiError && me.error.status === 401;
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-4">
        {unauthorized ? (
          <Spinner label="Sesi berakhir, mengalihkan ke Portal…" />
        ) : (
          <ErrorState
            className="w-full max-w-md"
            title="Gagal memuat profil"
            message={errorMessage(me.error)}
            onRetry={() => me.refetch()}
          />
        )}
      </div>
    );
  }

  return (
    <CurrentUserProvider user={me.data}>
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Lewati ke konten
      </a>
      <div className="min-h-[100dvh] md:pl-[264px]">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-sidebar-border md:block">
          <SidebarNav />
        </aside>

        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetContent side="left" className="w-[284px] p-0">
            <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
            <SheetDescription className="sr-only">Navigasi utama PrevenTech</SheetDescription>
            <SidebarNav onNavigate={() => setNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:h-16 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setNavOpen(true)}
            aria-label="Buka menu"
          >
            <Menu className="!size-5" />
          </Button>
          <div className="md:hidden">
            <Brand />
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
            <ThemeToggle />
            <NotificationBell />
            <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
            <UserMenu />
          </div>
        </header>

        <main id="konten" className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6" tabIndex={-1}>
          {children}
        </main>
      </div>
    </CurrentUserProvider>
  );
}
