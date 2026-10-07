"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Apple, Download, Settings, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getAppDownloads } from "@/lib/app-downloads";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { AppDownloadsPayload } from "@/types/app-downloads";

export const MOBILE_APP_SETTINGS_HREF = "/settings/mobile-app";
const STALE_TIME = 5 * 60 * 1000;

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** "1.2.1" -> "v1.2.1"; keeps an existing "v" prefix. */
function versionLabel(version: string): string {
  return /^v/i.test(version) ? version : `v${version}`;
}

/** Download button that opens the store/drive link in a new tab. */
function DownloadLink({
  href,
  icon,
  label,
  version,
  variant,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  version: string | null;
  variant: "default" | "outline";
}) {
  return (
    <Button variant={variant} className="flex-1 sm:flex-none" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        {icon}
        {label}
        {version ? <span className="tabular text-xs font-normal opacity-80">{versionLabel(version)}</span> : null}
      </a>
    </Button>
  );
}

interface AppDownloadCardViewProps {
  data: AppDownloadsPayload;
  /** Admin: shows the settings shortcut, and the "belum diatur" hint when no link exists. */
  canUpdate?: boolean;
  className?: string;
}

/**
 * Presentational card: title, one-line description, download buttons, notes.
 * Renders nothing when no link is set and the viewer cannot update them.
 */
export function AppDownloadCardView({ data, canUpdate = false, className }: AppDownloadCardViewProps) {
  const titleId = React.useId();
  const android = clean(data.android_url);
  const ios = clean(data.ios_url);
  const notes = clean(data.notes);
  const hasLinks = !!(android || ios);

  if (!hasLinks && !canUpdate) return null;

  return (
    <section className={cn("panel p-4 sm:p-5", className)} aria-labelledby={titleId}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-soft-foreground">
          <Smartphone className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-base font-semibold leading-tight tracking-tight">
            Aplikasi mobile PrevenTech
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Unduh dan pasang di HP untuk notifikasi, foto dari kamera, dan pengerjaan checklist di lapangan.
          </p>
        </div>
        {canUpdate && hasLinks ? (
          <Button variant="ghost" size="icon-sm" className="-mr-1 -mt-1 shrink-0 text-muted-foreground" asChild>
            <Link href={MOBILE_APP_SETTINGS_HREF} aria-label="Atur tautan unduhan aplikasi mobile">
              <Settings aria-hidden />
            </Link>
          </Button>
        ) : null}
      </div>

      {hasLinks ? (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {android ? (
              <DownloadLink
                href={android}
                icon={<Download aria-hidden />}
                label="Android (APK)"
                version={clean(data.android_version)}
                variant="default"
              />
            ) : null}
            {ios ? (
              <DownloadLink
                href={ios}
                icon={<Apple aria-hidden />}
                label="iPhone"
                version={clean(data.ios_version)}
                variant="outline"
              />
            ) : null}
          </div>
          {notes ? <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">{notes}</p> : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Tautan unduhan belum diatur.{" "}
          <Link
            href={MOBILE_APP_SETTINGS_HREF}
            className="rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Atur di Pengaturan &gt; Aplikasi Mobile
          </Link>
        </p>
      )}
    </section>
  );
}

/** Dashboard wrapper: loads `GET /app-downloads`, hides itself on error so the page never breaks. */
export function AppDownloadCard({ className }: { className?: string }) {
  const query = useQuery({
    queryKey: queryKeys.appDownloads,
    queryFn: ({ signal }) => getAppDownloads(signal),
    staleTime: STALE_TIME,
  });

  if (query.isPending) return <Skeleton className={cn("h-12 w-full rounded-xl", className)} />;
  if (query.isError || !query.data) return null;

  return (
    <AppDownloadCardView data={query.data.data} canUpdate={query.data.permissions.can_update} className={className} />
  );
}
