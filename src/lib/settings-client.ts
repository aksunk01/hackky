import type { UserSettings } from "@/lib/users";

/** PATCHes /api/settings and returns the updated settings, or throws the server's error message. */
export async function patchSettings(body: Record<string, unknown>): Promise<UserSettings> {
  const res = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data as UserSettings;
}
