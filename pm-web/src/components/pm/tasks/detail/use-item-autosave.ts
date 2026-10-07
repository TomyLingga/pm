"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, errorMessage } from "@/lib/api";
import { savePmTaskItems } from "@/lib/pm-tasks";
import { queryKeys } from "@/lib/query-keys";
import type { PmTaskItemInput } from "@/types/pm";

export type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

interface AutosaveOptions {
  taskId: number;
  /** Payload entry for an item from the latest answers; null = not sendable yet (stays dirty). */
  buildInput: (itemId: number) => PmTaskItemInput | null;
  /** Debounce after the last change (ms). */
  delay?: number;
}

/**
 * Auto-save of checklist answers: changed item ids are collected and, ~800 ms after the last
 * change, sent together to `PUT /pm-tasks/{id}/items` (only the changed items). Saves are
 * serialized; changes made while a request is running are sent in the next pass. Failed items
 * stay dirty so they are retried with the next change or via `flush()`.
 */
export function useItemAutosave({ taskId, buildInput, delay = 800 }: AutosaveOptions) {
  const queryClient = useQueryClient();
  const [state, setState] = React.useState<SaveState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);

  const dirty = React.useRef(new Set<number>());
  const timer = React.useRef<number | undefined>(undefined);
  const inFlight = React.useRef<Promise<boolean> | null>(null);
  /** Bumped when something else (photo upload/delete) changed the task on the server. */
  const externalEpoch = React.useRef(0);
  const buildRef = React.useRef(buildInput);

  React.useEffect(() => {
    buildRef.current = buildInput;
  }, [buildInput]);

  /** Saves everything that is dirty. Resolves true when nothing is left unsaved. */
  const flush = React.useCallback((): Promise<boolean> => {
    window.clearTimeout(timer.current);

    if (inFlight.current) {
      // Wait for the running request, then save what changed in the meantime.
      return inFlight.current.then(() => flush());
    }

    const inputs: PmTaskItemInput[] = [];
    for (const id of Array.from(dirty.current)) {
      const input = buildRef.current(id);
      if (input) inputs.push(input);
    }
    if (inputs.length === 0) {
      return Promise.resolve(dirty.current.size === 0);
    }

    const sentIds = inputs.map((input) => input.id);
    sentIds.forEach((id) => dirty.current.delete(id));
    const epochAtStart = externalEpoch.current;
    setState("saving");

    const request = savePmTaskItems(taskId, inputs)
      .then((detail) => {
        queryClient.setQueryData(queryKeys.pmTask(taskId), detail);
        // A photo was uploaded/deleted while this request was running: the response may predate it.
        if (externalEpoch.current !== epochAtStart) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.pmTask(taskId) });
        }
        setError(null);
        setSavedAt(new Date());
        setState(dirty.current.size > 0 ? "pending" : "saved");
        return dirty.current.size === 0;
      })
      .catch((err: unknown) => {
        sentIds.forEach((id) => dirty.current.add(id));
        setError(errorMessage(err, "Gagal menyimpan jawaban."));
        setState("error");
        // The task changed elsewhere (no longer in progress / reassigned): show the real state.
        if (err instanceof ApiError && (err.status === 409 || err.status === 403)) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.pmTask(taskId) });
        }
        return false;
      })
      .finally(() => {
        inFlight.current = null;
      });

    inFlight.current = request;
    return request;
  }, [queryClient, taskId]);

  const flushRef = React.useRef(flush);
  React.useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  /** Registers a changed item and (re)starts the debounce. */
  const markDirty = React.useCallback(
    (itemId: number) => {
      dirty.current.add(itemId);
      setState((current) => (current === "saving" ? current : "pending"));
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flushRef.current(), delay);
    },
    [delay],
  );

  const notifyExternalChange = React.useCallback(() => {
    externalEpoch.current += 1;
  }, []);

  // Do not lose the last edits when navigating away inside the app.
  React.useEffect(() => {
    const dirtyIds = dirty.current;
    return () => {
      window.clearTimeout(timer.current);
      if (dirtyIds.size > 0) void flushRef.current();
    };
  }, []);

  // Warn before closing/reloading the tab with unsaved answers.
  const hasUnsaved = state === "pending" || state === "saving" || state === "error";
  React.useEffect(() => {
    if (!hasUnsaved) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsaved]);

  return { state, error, savedAt, hasUnsaved, markDirty, flush, notifyExternalChange };
}
