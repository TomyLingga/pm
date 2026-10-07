import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ApiError, errorMessage } from '@/lib/api';
import { pmTaskApi } from '@/lib/endpoints';
import { buildItemPayload, draftFromItem, sameDraft, type ItemDraft } from '@/lib/pm';
import { queryKeys } from '@/lib/queryClient';
import type { PmItemPayload, PmTaskItem } from '@/lib/types';

export type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

const AUTOSAVE_DELAY_MS = 800;
const RETRY_DELAY_MS = 6000;

interface Options {
  taskId: number;
  items: PmTaskItem[];
  /** Saving is only allowed while the task is in progress (`permissions.can_work`). */
  enabled: boolean;
  /** Called on 403/409: the task changed on the server, reload it. */
  onConflict?: () => void;
}

/**
 * Checklist drafts with debounced auto-save (`PUT /pm-tasks/{id}/items`, changed items only).
 *
 * Local drafts are the source of truth for every item the user touched in this session, so a
 * server response can never overwrite what is being typed; untouched items follow the server.
 * Saves are serialised: changes made while a request is in flight go out in the next one.
 */
export function useChecklistAutosave({ taskId, items, enabled, onConflict }: Options) {
  const qc = useQueryClient();
  const draftsRef = useRef<Record<number, ItemDraft>>({});
  const [drafts, setDrafts] = useState<Record<number, ItemDraft>>({});
  const itemsRef = useRef<Map<number, PmTaskItem>>(new Map());
  const touched = useRef(new Set<number>());
  const dirty = useRef(new Set<number>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(true);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  /** Items whose values the server refused (422), by item id. Cleared when the item is edited again. */
  const [rejected, setRejected] = useState<Record<number, string>>({});

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const onConflictRef = useRef(onConflict);
  onConflictRef.current = onConflict;

  // Follow the server for items the user has not touched in this session.
  useEffect(() => {
    const map = new Map<number, PmTaskItem>();
    let next = draftsRef.current;
    let changed = false;
    for (const item of items) {
      map.set(item.id, item);
      const current = next[item.id];
      if (current && touched.current.has(item.id)) continue;
      const fresh = draftFromItem(item);
      if (!current || !sameDraft(current, fresh)) {
        if (!changed) {
          next = { ...next };
          changed = true;
        }
        next[item.id] = fresh;
      }
    }
    itemsRef.current = map;
    if (changed) {
      draftsRef.current = next;
      setDrafts(next);
    }
  }, [items]);

  const saveBatch = useCallback(
    async (payload: PmItemPayload[]) => {
      const detail = await pmTaskApi.saveItems(taskId, payload);
      // Only the detail cache is updated here; lists refresh on focus (avoids a refetch per keystroke burst).
      qc.setQueryData(queryKeys.pmTask(taskId), detail);
    },
    [qc, taskId],
  );

  /** Saves everything that is dirty. Never rejects; resolves false when something could not be saved. */
  const runSave = useCallback(async (): Promise<boolean> => {
    let ok = true;
    while (dirty.current.size > 0) {
      if (!enabledRef.current) {
        dirty.current.clear();
        break;
      }
      const ids = [...dirty.current];
      dirty.current = new Set();
      const payload: PmItemPayload[] = [];
      for (const id of ids) {
        const item = itemsRef.current.get(id);
        const draft = draftsRef.current[id];
        if (item && draft) payload.push(buildItemPayload(item, draft));
      }
      if (payload.length === 0) continue;
      setState('saving');
      try {
        await saveBatch(payload);
      } catch (e) {
        const status = e instanceof ApiError ? e.status : 0;
        if (status === 403 || status === 409) {
          // The task is no longer editable: drop the pending changes and reload.
          dirty.current.clear();
          setError(errorMessage(e));
          setState('error');
          onConflictRef.current?.();
          return false;
        }
        if (status === 422) {
          // Isolate the refused item(s) so the valid ones in the same batch are not lost.
          const refused: Record<number, string> = {};
          if (payload.length === 1) {
            refused[payload[0].id] = errorMessage(e);
          } else {
            for (let i = 0; i < payload.length; i++) {
              try {
                await saveBatch([payload[i]]);
              } catch (inner) {
                if (inner instanceof ApiError && inner.status === 422) {
                  refused[payload[i].id] = errorMessage(inner);
                } else {
                  // Network/server failure: keep the rest for the next attempt.
                  for (const rest of payload.slice(i)) dirty.current.add(rest.id);
                  setRejected((prev) => ({ ...prev, ...refused }));
                  setError(errorMessage(inner));
                  setState('error');
                  return false;
                }
              }
            }
          }
          if (Object.keys(refused).length > 0) {
            ok = false;
            setRejected((prev) => ({ ...prev, ...refused }));
          }
          continue;
        }
        // Network / server error: keep the changes and retry later.
        for (const id of ids) dirty.current.add(id);
        setError(errorMessage(e));
        setState('error');
        return false;
      }
    }
    if (ok) {
      setError(null);
      setState((prev) => (prev === 'idle' ? 'idle' : 'saved'));
    } else {
      setError('Sebagian isian ditolak server. Periksa butir yang ditandai.');
      setState('error');
    }
    return ok;
  }, [saveBatch]);

  const flushRef = useRef<() => Promise<boolean>>(() => Promise.resolve(true));

  /** Saves pending changes now (queued behind any request in flight). */
  const flush = useCallback((): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const next = chain.current.then(() => runSave());
    chain.current = next.catch(() => false);
    void next.then((ok) => {
      // Flaky signal in the field: retry automatically while changes are still pending.
      if (!ok && mounted.current && dirty.current.size > 0 && !timer.current) {
        timer.current = setTimeout(() => {
          timer.current = null;
          void flushRef.current();
        }, RETRY_DELAY_MS);
      }
    });
    return next;
  }, [runSave]);
  flushRef.current = flush;

  const update = useCallback((itemId: number, patch: Partial<ItemDraft>) => {
    const current = draftsRef.current[itemId];
    if (!current || !enabledRef.current) return;
    const next = { ...draftsRef.current, [itemId]: { ...current, ...patch } };
    draftsRef.current = next;
    setDrafts(next);
    touched.current.add(itemId);
    dirty.current.add(itemId);
    setRejected((prev) => {
      if (!(itemId in prev)) return prev;
      const rest = { ...prev };
      delete rest[itemId];
      return rest;
    });
    setState('pending');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void flushRef.current();
    }, AUTOSAVE_DELAY_MS);
  }, []);

  // Save when the app goes to the background and make a last attempt on unmount.
  useEffect(() => {
    mounted.current = true;
    const sub = AppState.addEventListener('change', (status) => {
      if (status !== 'active' && dirty.current.size > 0) void flushRef.current();
    });
    return () => {
      mounted.current = false;
      sub.remove();
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (dirty.current.size > 0) void flushRef.current();
    };
  }, []);

  return { drafts, update, flush, state, error, rejected };
}
