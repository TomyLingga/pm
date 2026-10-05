"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AttachmentsPanel } from "@/components/common/attachments-panel";
import { useCurrentUser } from "@/components/layout/current-user";
import { MAX_ATTACHMENTS, SR_ATTACHMENT_COLLECTION_LABELS } from "@/lib/constants";
import { queryKeys } from "@/lib/query-keys";
import { serviceRequestCollectionFor, uploadServiceRequestAttachment } from "@/lib/service-requests";
import type { ServiceRequestDetail } from "@/types/service-request";

/** Statuses after which attachments are frozen (mirrors the WO rule "not closed/cancelled"). */
const FINAL_STATUSES = new Set(["completed", "rejected", "cancelled", "converted"]);

export function RequestAttachments({ request }: { request: ServiceRequestDetail }) {
  const me = useCurrentUser();
  const queryClient = useQueryClient();

  return (
    <AttachmentsPanel
      attachments={request.attachments}
      canUpload={request.permissions.can_upload}
      canDelete={(attachment) => !FINAL_STATUSES.has(request.status) && attachment.uploaded_by?.id === me.id}
      upload={(file, collection) => uploadServiceRequestAttachment(request.id, file, collection)}
      onChanged={() => queryClient.invalidateQueries({ queryKey: queryKeys.serviceRequest(request.id) })}
      collections={["document", "photo_before"]}
      collectionLabels={SR_ATTACHMENT_COLLECTION_LABELS}
      collectionFor={serviceRequestCollectionFor}
      maxFiles={MAX_ATTACHMENTS}
    />
  );
}
