"use client";

import * as React from "react";
import type { Me } from "@/types/auth";

const CurrentUserContext = React.createContext<Me | null>(null);

export function CurrentUserProvider({ user, children }: { user: Me; children: React.ReactNode }) {
  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}

/** The logged-in user. Only usable below the protected AppShell (which waits for `/auth/me`). */
export function useCurrentUser(): Me {
  const user = React.useContext(CurrentUserContext);
  if (!user) throw new Error("useCurrentUser must be used inside <CurrentUserProvider>");
  return user;
}
