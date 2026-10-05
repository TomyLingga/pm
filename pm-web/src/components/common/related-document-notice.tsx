import Link from "next/link";
import { ArrowRightLeft, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RelatedDocumentNoticeProps {
  /** `converted` = this document moved to another one; `source` = it was created from another one. */
  kind: "converted" | "source";
  text: string;
  href: string;
  linkLabel: string;
  reason?: string | null;
  className?: string;
}

/** Banner linking a WO and its Form Request counterpart (conversion in either direction). */
export function RelatedDocumentNotice({ kind, text, href, linkLabel, reason, className }: RelatedDocumentNoticeProps) {
  const Icon = kind === "converted" ? ArrowRightLeft : Link2;
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-sm",
        kind === "converted" ? "border-purple-200 bg-purple-50 text-purple-950" : "border-sky-200 bg-sky-50 text-sky-950",
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1">
        <p>
          {text}{" "}
          <Link href={href} className="font-mono font-semibold underline underline-offset-2">
            {linkLabel}
          </Link>
        </p>
        {reason ? <p className="whitespace-pre-wrap text-xs opacity-80">Alasan: {reason}</p> : null}
      </div>
    </div>
  );
}
