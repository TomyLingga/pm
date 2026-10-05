import type { ValidationErrors } from "@/types/api";
import { ApiError } from "./api";

/** Validation errors of a failed request (empty unless 422). */
export function validationErrors(error: unknown): ValidationErrors {
  return error instanceof ApiError && error.status === 422 ? error.errors : {};
}

function keyMatches(key: string, pattern: string): boolean {
  return pattern.endsWith(".*") ? key.startsWith(pattern.slice(0, -1)) : key === pattern;
}

/** First message for any of the given keys (supports `prefix.*` wildcard). */
export function firstError(errors: ValidationErrors, ...keys: string[]): string | undefined {
  for (const pattern of keys) {
    const match = Object.keys(errors).find((key) => keyMatches(key, pattern));
    if (match && errors[match]?.[0]) return errors[match][0];
  }
  return undefined;
}

/**
 * The server's summary message for a 422 whose field errors are not shown inline
 * (none of `shownKeys` matched), so nothing gets silently swallowed.
 */
export function unmatchedValidationMessage(error: unknown, shownKeys: string[]): string | undefined {
  if (!(error instanceof ApiError) || error.status !== 422) return undefined;
  const shown = Object.keys(error.errors).some((key) => shownKeys.some((pattern) => keyMatches(key, pattern)));
  return shown ? undefined : error.message;
}
