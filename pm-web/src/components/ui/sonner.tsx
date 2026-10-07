"use client";

import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/components/theme/theme-provider";

export function Toaster() {
  const { resolved } = useTheme();
  return (
    <Sonner
      position="top-center"
      theme={resolved}
      closeButton
      toastOptions={{
        classNames: {
          toast: "!rounded-lg !border-border !bg-popover !text-popover-foreground !shadow-lg text-sm",
          description: "!text-muted-foreground",
          success: "[&_[data-icon]]:text-success",
          error: "[&_[data-icon]]:text-danger",
          warning: "[&_[data-icon]]:text-warning",
          info: "[&_[data-icon]]:text-info",
          closeButton: "!border-border !bg-popover !text-muted-foreground hover:!text-foreground",
        },
      }}
    />
  );
}

export { toast } from "sonner";
