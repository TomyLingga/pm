import { AppShell } from "@/components/layout/app-shell";

/** Protected area: requires the session cookie (middleware) and a valid `/auth/me`. */
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
