import { PmAccessGuard } from "@/components/pm/pm-access-guard";

/** Equipment master + maintenance history: executor staff, admin and management only. */
export default function EquipmentLayout({ children }: { children: React.ReactNode }) {
  return <PmAccessGuard>{children}</PmAccessGuard>;
}
