import { Ban, Check, ChevronDown, Clock3, Minus, Phone, RotateCcw, Stamp, X } from "lucide-react";
import { StepStatusChip } from "@/components/common/badges";
import { Section } from "@/components/common/section";
import { SignatureLink } from "@/components/common/signature-link";
import { APPROVAL_ROLE_LABELS } from "@/lib/constants";
import { formatDateTimeMedium, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DocumentSignature } from "@/types/common";
import type { ApprovalStep, ApprovalStepStatus, ServiceRequestDetail } from "@/types/service-request";

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

/** Stepper node per step state: solid for decided steps, outlined for the rest. */
const NODE_STYLES: Record<ApprovalStepStatus, string> = {
  approved: "border-success bg-success text-success-on-solid",
  completed: "border-success bg-success text-success-on-solid",
  rejected: "border-danger bg-danger text-danger-on-solid",
  revision_requested: "border-warning bg-warning text-warning-on-solid",
  pending: "border-warning bg-warning-soft text-warning-foreground ring-4 ring-warning/15",
  waiting: "border-border bg-card text-muted-foreground",
  skipped: "border-dashed border-muted-foreground/50 bg-card text-muted-foreground",
  cancelled: "border-border bg-surface-2 text-muted-foreground",
};

function StepIcon({ status }: { status: ApprovalStepStatus }) {
  const className = "h-3.5 w-3.5";
  switch (status) {
    case "approved":
    case "completed":
      return <Check className={className} aria-hidden strokeWidth={3} />;
    case "rejected":
      return <X className={className} aria-hidden strokeWidth={3} />;
    case "revision_requested":
      return <RotateCcw className={className} aria-hidden strokeWidth={2.5} />;
    case "pending":
      return <Clock3 className={className} aria-hidden />;
    case "cancelled":
      return <Ban className={className} aria-hidden />;
    default:
      return <Minus className={className} aria-hidden />;
  }
}

function StepRow({
  step,
  signature,
  isLast,
}: {
  step: ApprovalStep;
  signature?: DocumentSignature;
  isLast: boolean;
}) {
  const acted = ACTED_STATUSES.has(step.status) && !!step.acted_at;
  const role = APPROVAL_ROLE_LABELS[step.key] ?? step.label.toUpperCase();
  const isPending = step.status === "pending";

  return (
    <li className="relative flex gap-3 sm:gap-4" aria-current={isPending ? "step" : undefined}>
      {/* Rail + node */}
      <div className="flex w-7 shrink-0 flex-col items-center">
        <span
          className={cn(
            "z-10 flex h-7 w-7 items-center justify-center rounded-full border-2",
            NODE_STYLES[step.status] ?? NODE_STYLES.waiting,
          )}
        >
          <StepIcon status={step.status} />
        </span>
        {isLast ? null : <span className="-mb-1 mt-1 w-px flex-1 bg-border" aria-hidden />}
      </div>

      {/* Body */}
      <div
        className={cn(
          "mb-3 min-w-0 flex-1 rounded-lg border px-3 py-2.5 transition-colors duration-150",
          isPending ? "border-warning/40 bg-warning-soft/50" : "border-transparent",
          isLast && "mb-0",
        )}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{role}</p>
          <StepStatusChip status={step.status} label={step.status_label} />
        </div>

        <div className="mt-1 space-y-1 text-sm">
          {acted ? (
            <p className="break-words">
              {actedVerb(step)} <span className="font-semibold">{step.acted_by?.name ?? step.assignee_label ?? "-"}</span>
              <span className="text-muted-foreground">
                {" "}
                pada <span className="tabular">{formatDateTimeMedium(step.acted_at)}</span>
              </span>
            </p>
          ) : (
            <p className={cn("break-words", isPending ? "text-foreground" : "text-muted-foreground")}>
              {waitingText(step)}
              {isPending && step.activated_at ? (
                <span className="tabular text-xs text-muted-foreground"> sejak {formatRelative(step.activated_at)}</span>
              ) : null}
            </p>
          )}

          {step.notes ? (
            <p className="whitespace-pre-wrap break-words rounded-md border bg-surface-2 px-2.5 py-1.5 text-xs">
              <span className="font-medium text-muted-foreground">Catatan: </span>
              {step.notes}
            </p>
          ) : null}

          {(acted && step.actor_phone) || signature ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {acted && step.actor_phone ? (
                <a
                  href={`tel:${step.actor_phone}`}
                  className="tabular inline-flex items-center gap-1 rounded-sm underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  {step.actor_phone}
                </a>
              ) : null}
              {signature ? <SignatureLink verifyUrl={signature.verify_url} label="Verifikasi QR" /> : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function StepList({ steps, signatures }: { steps: ApprovalStep[]; signatures: DocumentSignature[] }) {
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  return (
    <ol className="space-y-0">
      {sorted.map((step, index) => (
        <StepRow
          key={step.id}
          step={step}
          isLast={index === sorted.length - 1}
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

/** PENGESAHAN block as a vertical stepper (form INLHO/BSIS-ITC/F-004), plus earlier rounds (collapsed). */
export function ApprovalPanel({ request }: { request: ServiceRequestDetail }) {
  const currentRound = request.approval_steps.reduce((max, step) => Math.max(max, step.round), request.revision_no);
  const earlier = request.approval_history.filter((step) => step.round < currentRound);
  const rounds = Array.from(new Set(earlier.map((step) => step.round))).sort((a, b) => b - a);
  const done = request.approval_steps.filter(
    (step) => step.status === "approved" || step.status === "completed",
  ).length;

  return (
    <Section
      title="Pengesahan"
      icon={<Stamp aria-hidden />}
      actions={
        request.approval_steps.length > 0 ? (
          <span className="tabular text-xs text-muted-foreground">
            {done} dari {request.approval_steps.length} selesai
          </span>
        ) : undefined
      }
    >
      {request.approval_steps.length === 0 ? (
        <p className="text-sm text-muted-foreground">Rantai persetujuan dibuat saat Form Request diajukan.</p>
      ) : (
        <StepList steps={request.approval_steps} signatures={request.signatures} />
      )}

      {rounds.length > 0 ? (
        <div className="mt-5 space-y-2 border-t pt-4">
          <p className="text-xs font-medium text-muted-foreground">Putaran sebelumnya</p>
          {rounds.map((round) => (
            <details key={round} className="group rounded-lg border bg-surface-2/40">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <span>
                  Putaran {round + 1}
                  <span className="font-normal text-muted-foreground">
                    {round === 0 ? " (pengajuan awal)" : ` (revisi ke-${round})`}
                  </span>
                </span>
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="border-t px-3 pb-1 pt-3">
                <StepList steps={earlier.filter((step) => step.round === round)} signatures={[]} />
              </div>
            </details>
          ))}
        </div>
      ) : null}
    </Section>
  );
}
