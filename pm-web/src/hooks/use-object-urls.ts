"use client";

import { useEffect, useState } from "react";

/**
 * Object URLs for local file previews. URLs are created inside the effect so that
 * React StrictMode's mount/unmount/mount cycle never leaves revoked URLs on screen.
 * The array may briefly lag behind `files` by one render, so index access can be undefined.
 */
export function useObjectUrls(files: File[]): Array<string | undefined> {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const next = files.map((file) => URL.createObjectURL(file));
    setUrls(next);
    return () => next.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  return files.map((_, index) => urls[index]);
}
