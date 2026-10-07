"use client";

import * as React from "react";
import { cn, initials } from "@/lib/utils";

interface UserAvatarProps {
  name: string | null | undefined;
  photoUrl?: string | null;
  className?: string;
}

/** Portal profile photo (absolute URL) with an initials fallback. */
export function UserAvatar({ name, photoUrl, className }: UserAvatarProps) {
  const [failed, setFailed] = React.useState(false);
  const showPhoto = !!photoUrl && !failed;

  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground ring-1 ring-inset ring-primary/10",
        showPhoto && "bg-surface-2",
        className,
      )}
      aria-hidden
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- external Portal photo, no optimisation needed
        <img
          src={photoUrl}
          alt=""
          width={64}
          height={64}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
