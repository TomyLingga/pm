import { api } from "./api";

/** `DELETE /attachments/{id}` (uploader only, document not final). Shared by WO and Form Request. */
export function deleteAttachment(attachmentId: number): Promise<void> {
  return api.delete<void>(`/attachments/${attachmentId}`);
}
