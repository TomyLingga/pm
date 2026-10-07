import { PmAccessGuard } from "@/components/pm/pm-access-guard";

/** Preventive Maintenance: executor staff, admin and management only. */
export default function PmLayout({ children }: { children: React.ReactNode }) {
  return <PmAccessGuard>{children}</PmAccessGuard>;
}
