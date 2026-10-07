import { Camera, ListChecks } from "lucide-react";
import { Section } from "@/components/common/section";
import { INPUT_TYPE_LABELS } from "@/lib/pm-constants";
import type { ChecklistItemDef } from "@/types/pm";
import { groupBySection, rangeHint } from "./checklist-model";

/** Read-only checklist shown before the task is started (items are copied from the template on start). */
interface ChecklistPreviewProps {
  items: ChecklistItemDef[];
  templateName?: string | null;
  /** Shown under the list; the default explains that the checklist opens once the task is started. */
  footnote?: string;
}

export function ChecklistPreview({
  items,
  templateName,
  footnote = "Checklist dapat diisi setelah tugas dimulai.",
}: ChecklistPreviewProps) {
  const groups = groupBySection(items);
  let position = 0;

  return (
    <Section
      title="Checklist"
      icon={<ListChecks className="h-4 w-4" aria-hidden />}
      actions={<span className="tabular text-xs text-muted-foreground">{items.length} butir</span>}
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Template checklist belum memiliki butir.</p>
      ) : (
        <div className="space-y-4">
          {templateName ? <p className="text-xs text-muted-foreground">Template: {templateName}</p> : null}
          {groups.map((group) => (
            <div key={group.section ?? "__default"}>
              {group.section || groups.length > 1 ? (
                <h3 className="mb-1 text-sm font-semibold">{group.section ?? "Umum"}</h3>
              ) : null}
              <ol className="divide-y">
                {group.items.map((item) => {
                  position += 1;
                  const hint = item.input_type === "number" ? rangeHint(item) : null;
                  return (
                    <li key={item.id} className="flex items-start gap-3 py-2.5">
                      <span className="tabular mt-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 px-1 text-[11px] font-semibold text-muted-foreground">
                        {position}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          {item.description}
                          {item.is_required ? (
                            <span className="ml-1 text-destructive" aria-hidden>
                              *
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                          <span>{INPUT_TYPE_LABELS[item.input_type] ?? item.input_type}</span>
                          {hint ? <span className="tabular">{hint}</span> : null}
                          {item.photo_required ? (
                            <span className="inline-flex items-center gap-1 font-medium text-warning-foreground">
                              <Camera className="h-3 w-3" aria-hidden />
                              Foto wajib
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            <span className="text-destructive">*</span> wajib diisi. {footnote}
          </p>
        </div>
      )}
    </Section>
  );
}
