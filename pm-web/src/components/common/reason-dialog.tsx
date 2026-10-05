"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { firstError, unmatchedValidationMessage, validationErrors } from "@/lib/validation";

interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  label: string;
  placeholder?: string;
  required?: boolean;
  confirmLabel: string;
  confirmVariant?: ButtonProps["variant"];
  /** API field the text is sent as (for 422 messages), e.g. `reason`, `notes`. */
  fieldKey: string;
  loading?: boolean;
  /** Error of the last submit (422 messages are shown inline). */
  error?: unknown;
  onSubmit: (text: string) => void;
  /** Extra fields rendered above the textarea. */
  children?: React.ReactNode;
}

function ReasonForm({
  label,
  placeholder,
  required,
  confirmLabel,
  confirmVariant = "default",
  fieldKey,
  loading,
  error,
  onSubmit,
  onCancel,
  children,
}: Omit<ReasonDialogProps, "open" | "onOpenChange" | "title" | "description"> & { onCancel: () => void }) {
  const [text, setText] = React.useState("");
  const [clientError, setClientError] = React.useState<string | null>(null);
  const serverError = firstError(validationErrors(error), fieldKey);
  const fieldError = clientError ?? serverError;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (required && !text.trim()) {
      setClientError(`${label} wajib diisi.`);
      return;
    }
    setClientError(null);
    onSubmit(text.trim());
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {children}
      <Field label={label} htmlFor={`reason-${fieldKey}`} required={required} error={fieldError}>
        <Textarea
          id={`reason-${fieldKey}`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          rows={4}
          maxLength={2000}
          autoFocus
          invalid={!!fieldError}
        />
      </Field>
      <FieldError message={unmatchedValidationMessage(error, [fieldKey])} />
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Batal
        </Button>
        <Button type="submit" variant={confirmVariant} loading={loading}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Dialog with a single (optionally required) text field: reasons, notes, closing remarks. */
export function ReasonDialog({ open, onOpenChange, title, description, ...formProps }: ReasonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !formProps.loading && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {open ? <ReasonForm {...formProps} onCancel={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
