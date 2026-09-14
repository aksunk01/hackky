import "server-only";

import { appendFile } from "fs/promises";

const DEBUG_LOG_PATH = "/tmp/hackky-debug.log";

/** Best-effort append-only debug log for errors we deliberately hide behind a generic user-facing message. */
export async function logServerError(context: string, error: unknown): Promise<void> {
  const err = error as { code?: number | string; message?: string; details?: string } | undefined;
  const entry = {
    timestamp: new Date().toISOString(),
    context,
    code: err?.code ?? null,
    message: err?.message ?? String(error),
    details: err?.details ?? null,
  };
  try {
    await appendFile(DEBUG_LOG_PATH, JSON.stringify(entry) + "\n");
  } catch {
    // Logging must never break the page it's called from.
  }
}
