import { InfoList, type InfoItem } from "@/components/common/section";
import type { Me } from "@/types/auth";
import type { ServiceRequestIdentity } from "@/types/service-request";

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

const linkClassName =
  "break-all rounded-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** "IDENTITAS KARYAWAN" block (read-only): label/value grid, same rhythm as the other detail sections. */
export function IdentityBlock({ identity, className }: { identity: ServiceRequestIdentity; className?: string }) {
  const items: InfoItem[] = [
    { label: "Nama lengkap", value: identity.name },
    { label: "Status karyawan", value: identity.employment_status },
    { label: "NRK", value: identity.nrk ? <span className="tabular font-mono">{identity.nrk}</span> : null },
    { label: "Jabatan", value: identity.position },
    ...(identity.superior_name ? [{ label: "Atasan", value: identity.superior_name }] : []),
    { label: "Divisi / Bagian", value: identity.bagian },
    { label: "Departemen / Sub bagian", value: identity.sub_bagian },
    {
      label: "Email INL",
      value: identity.email ? (
        <a href={`mailto:${identity.email}`} className={linkClassName}>
          {identity.email}
        </a>
      ) : null,
    },
    {
      label: "No. HP",
      value: identity.phone ? (
        <a href={`tel:${identity.phone}`} className={`tabular ${linkClassName}`}>
          {identity.phone}
        </a>
      ) : null,
    },
  ];

  return <InfoList items={items} className={className} />;
}
