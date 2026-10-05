import { ChevronDown, Stamp } from "lucide-react";
import { StepStatusChip } from "@/components/common/badges";
import { Section } from "@/components/common/section";
import { SignatureLink } from "@/components/common/signature-link";
import { APPROVAL_ROLE_LABELS } from "@/lib/constants";
import { formatDateTimeMedium, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DocumentSignature } from "@/types/common";
import type { ApprovalStep, ServiceRequestDetail } from "@/types/service-request";

const ACTED_STATUSES = new Set(["approved", "completed", "rejected", "revision_requested"]);

function actedVerb(step: ApprovalStep): string {
  switch (step.status) {
    case "rejected":
      return "Ditolak oleh";
    case "revision_requested":
      return "Diminta revisi oleh";
    default:
      if (step.key === "submission" || step.kind === "submission") return "Diminta oleh";
      if (step.key === "executor" || step.kind === "completion") return "Diselesaikan oleh";
      return "Disetujui oleh";
  }
}

function waitingText(step: ApprovalStep): string {
  const who = step.assignee_label ?? step.assignee_user?.name;
  switch (step.status) {
    case "pending":
      if (step.key === "executor" || step.kind === "completion") {
        return who ? `Menunggu penyelesaian oleh ${who}` : "Menunggu penyelesaian";
      }
      return who ? `Menunggu persetujuan ${who}` : "Menunggu persetujuan";
    case "waiting":
      return who ? `Belum giliran (${who})` : "Belum giliran";
    case "skipped":
      return step.key === "superior" ? "Dilewati (tidak ada atasan dengan grade lebih tinggi)" : "Dilewati";
    case "cancelled":
      return "Dibatalkan";
    default:
      return who ?? "-";
  }
}

function StepRow({ step, signature }: { step: ApprovalStep; signature?: DocumentSignature }) {
  const acted = ACTED_STATUSES.has(step.status) && !!step.acted_at;
  const role = APPROVAL_ROLE_LABELS[step.key] ?? step.label.toUpperCase();

  return (
    <li
      className={cn(
        "grid grid-cols-1 gap-x-3 gap-y-1 py-3 sm:grid-cols-[9.5rem_1fr]",
        step.status === "pending" && "-mx-2 rounded-md bg-amber-50 px-2",
      )}
    >
      <p className="text-xs font-bold uppercase tracking-wide">{role}</p>
      <div className="min-w-0 space-y-1 text-sm">
        {acted ? (
          <p>
            <span className="hidden sm:inline">: </span>
            {actedVerb(step)} <span className="font-semibold">{step.acted_by?.name ?? step.assignee_label ?? "-"}</span>{" "}
            pada {formatDateTimeMedium(step.acted_at)}
            {step.status === "rejected" || step.status === "revision_requested" ? (
              <StepStatusChip status={step.status} label={step.status_label} className="ml-2 align-middle" />
            ) : null}
          </p>
        ) : (
          <p className="flex flex-wrap items-center gap-2">
            <StepStatusChip status={step.status} label={step.status_label} />
            <span className="text-muted-foreground">{waitingText(step)}</span>
            {step.status === "pending" && step.activated_at ? (
              <span className="text-xs text-muted-foreground">sejak {formatRelative(step.activated_at)}</span>
            ) : null}
          </p>
        )}
        {step.notes ? (
          <p className="whitespace-pre-wrap rounded bg-muted/60 px-2 py-1 text-xs">Catatan: {step.notes}</p>
        ) : null}
        {signature ? <SignatureLink verifyUrl={signature.verify_url} label="Verifikasi QR" /> : null}
      </div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">No. HP</p>
      <p className="text-sm">
        <span className="hidden sm:inline">: </span>
        {acted && step.actor_phone ? (
          <a href={`tel:${step.actor_phone}`} className="hover:underline">
            {step.actor_phone}
          </a>
        ) : (
          "-"
        )}
      </p>
    </li>
  );
}

function StepList({ steps, signatures }: { steps: ApprovalStep[]; signatures: DocumentSignature[] }) {
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  return (
    <ol className="divide-y">
      {sorted.map((step) => (
        <StepRow
          key={step.id}
          step={step}
          signature={
            ACTED_STATUSES.has(step.status) && step.status !== "rejected" && step.status !== "revision_requested"
              ? signatures.find((s) => s.role_key === step.key)
              : undefined
          }
        />
      ))}
    </ol>
  );
}

/** PENGESAHAN block rendered like form INLHO/BSIS-ITC/F-004, plus earlier rounds (collapsed). */
export function ApprovalPanel({ request }: { request: ServiceRequestDetail }) {
  const currentRound = request.approval_steps.reduce((max, step) => Math.max(max, step.round), request.revision_no);
  const earlier = request.approval_history.filter((step) => step.round < currentRound);
  const rounds = Array.from(new Set(earlier.map((step) => step.round))).sort((a, b) => b - a);

  return (
    <Section title="Pengesahan" icon={<Stamp className="h-4 w-4" aria-hidden />}>
      {request.approval_steps.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Rantai persetujuan dibuat saat Form Request diajukan.
        </p>
      ) : (
        <StepList steps={request.approval_steps} signatures={request.signatures} />
      )}

      {rounds.length > 0 ? (
        <div className="mt-4 space-y-2 border-t pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Putaran sebelumnya</p>
          {rounds.map((round) => (
            <details key={round} className="group rounded-md border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium">
                Putaran {round + 1}
                {round === 0 ? " (pengajuan awal)" : ` (revisi ke-${round})`}
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="border-t px-3">
                <StepList steps={earlier.filter((step) => step.round === round)} signatures={[]} />
              </div>
            </details>
          ))}
        </div>
      ) : null}
    </Section>
  );
}
