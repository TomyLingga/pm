import type { Me } from "@/types/auth";
import type { ServiceRequestIdentity } from "@/types/service-request";
import { cn } from "@/lib/utils";

export function identityFromMe(me: Me): ServiceRequestIdentity {
  return {
    name: me.name,
    employment_status: me.employment_status,
    nrk: me.nrk,
    position: me.position,
    superior_name: null,
    bagian: me.bagian,
    sub_bagian: me.sub_bagian,
    email: me.email,
    phone: me.phone,
  };
}

/** "IDENTITAS KARYAWAN" block (read-only), laid out like the paper form. */
export function IdentityBlock({ identity, className }: { identity: ServiceRequestIdentity; className?: string }) {
  const rows: Array<[string, string | null]> = [
    ["Nama lengkap", identity.name],
    ["Status karyawan", identity.employment_status],
    ["NRK", identity.nrk],
    ["Jabatan", identity.position],
    ...(identity.superior_name ? ([["Atasan", identity.superior_name]] as Array<[string, string | null]>) : []),
    ["Divisi / Bagian", identity.bagian],
    ["Departemen / Sub bagian", identity.sub_bagian],
    ["Email INL", identity.email],
    ["No. HP", identity.phone],
  ];

  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2", className)}>
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[9.5rem_1fr] gap-2 text-sm">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words">{value || "-"}</dd>
        </div>
      ))}
    </dl>
  );
}
