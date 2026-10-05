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
        "inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary",
        className,
      )}
      aria-hidden
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- external Portal photo, no optimisation needed
        <img
          src={photoUrl}
          alt=""
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
