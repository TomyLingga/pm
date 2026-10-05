"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AttachmentsPanel } from "@/components/common/attachments-panel";
import { useCurrentUser } from "@/components/layout/current-user";
import { MAX_ATTACHMENTS } from "@/lib/constants";
import { queryKeys } from "@/lib/query-keys";
import { uploadAttachment } from "@/lib/work-orders";
import type { WorkOrderDetail } from "@/types/work-order";

const FINAL_STATUSES = new Set(["closed", "cancelled", "converted"]);

export function AttachmentsSection({ wo }: { wo: WorkOrderDetail }) {
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  const afterWork = wo.status === "in_progress" || wo.status === "completed";

  return (
    <AttachmentsPanel
      key={wo.status}
      attachments={wo.attachments}
      canUpload={wo.permissions.can_upload}
      canDelete={(attachment) => !FINAL_STATUSES.has(wo.status) && attachment.uploaded_by?.id === me.id}
      upload={(file, collection) => uploadAttachment(wo.id, file, collection)}
      onChanged={() => queryClient.invalidateQueries({ queryKey: queryKeys.workOrder(wo.id) })}
      collections={["photo_before", "photo_after", "document"]}
      defaultCollection={afterWork ? "photo_after" : "photo_before"}
      maxFiles={MAX_ATTACHMENTS}
    />
  );
}
