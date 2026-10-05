"use client";

import { FilePicker } from "@/components/common/file-picker";
import { PHOTO_MIME_TYPES } from "@/lib/constants";

interface PhotoPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  /** Remaining slots (10 per WO minus existing attachments). */
  max: number;
  disabled?: boolean;
}

/** WO photo picker (jpg/png/webp, max 5 MB each). */
export function PhotoPicker(props: PhotoPickerProps) {
  return <FilePicker {...props} accept={PHOTO_MIME_TYPES} />;
}
