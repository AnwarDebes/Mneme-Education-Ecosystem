// Shared error-toast helpers so the wording stays consistent and every
// failure surfaces the underlying message rather than leaving the user
// with a context-free "Failed".

import { toast } from "sonner";

/**
 * Show an error toast for a failed action. ``action`` is the user-facing
 * verb phrase ("save", "delete deck", "extract text"). The toast renders
 * "Could not {action}" with the error message as the description.
 */
export function toastActionFailed(action: string, err: unknown): void {
  toast.error(`Could not ${action}`, {
    description: errorMessage(err),
  });
}

/**
 * Pull a readable message off any thrown / rejected value. Plays nicely
 * with native ``Error`` instances, our own ``ApiError``, and bare strings
 * (which sometimes come back from FastAPI's ``detail`` field).
 */
export function errorMessage(err: unknown): string {
  if (err == null) return "Unknown error.";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  const maybe = (err as { message?: unknown }).message;
  if (typeof maybe === "string") return maybe;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
