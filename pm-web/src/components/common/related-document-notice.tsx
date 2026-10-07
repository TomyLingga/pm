import Link from "next/link";
import { ArrowRightLeft, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RelatedDocumentNoticeProps {
  /** `converted` = this document moved to another one; `source` = it was created from another one. */
  kind: "converted" | "source";
  text: string;
  href: string;
  linkLabel: string;
  /** Plain text after the link (e.g. the checklist item of a PM finding). */
  suffix?: string;
  reason?: string | null;
  className?: string;
}

/** Banner linking a document to its counterpart (WO <-> Form Request conversion, WO from a PM finding). */
export function RelatedDocumentNotice({
  kind,
  text,
  href,
  linkLabel,
  suffix,
  reason,
  className,
}: RelatedDocumentNoticeProps) {
  const Icon = kind === "converted" ? ArrowRightLeft : Link2;
  return (
    <div
      role="note"
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-sm",
        kind === "converted"
          ? "border-info/25 bg-info-soft text-info-foreground"
          : "border-primary/20 bg-primary-soft text-primary-soft-foreground",
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1">
        <p className="break-words">
          {text}{" "}
          <Link
            href={href}
            className="rounded-sm font-mono font-semibold underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {linkLabel}
          </Link>
          {suffix ? ` ${suffix}` : null}
        </p>
        {reason ? <p className="whitespace-pre-wrap break-words text-xs opacity-80">Alasan: {reason}</p> : null}
      </div>
    </div>
  );
}
