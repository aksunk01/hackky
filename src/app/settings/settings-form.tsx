"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, textInputClass } from "@/components/ui";
import { API_KEY_PROVIDERS, API_KEY_PROVIDER_META, hasRequiredApiKeys, type ApiKeyProvider } from "@/lib/api-key-providers";
import { patchSettings } from "@/lib/settings-client";
import type { UserSettings } from "@/lib/users";

type AsyncState = { busy: boolean; message: string | null; error: boolean };
const IDLE: AsyncState = { busy: false, message: null, error: false };

function Banner({ tone, children }: { tone: "success" | "error"; children: React.ReactNode }) {
  return (
    <p className={`text-sm ${tone === "success" ? "text-success" : "text-danger"}`}>{children}</p>
  );
}

function Toggle({ checked, onChange, label, description }: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start justify-between gap-4 text-left"
    >
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-sm text-muted">{description}</span>
      </span>
      <span
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-accent" : "bg-subtle border border-border-strong"
        }`}
      >
        <span
          className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
}

export function SettingsForm({
  email,
  initial,
  next,
}: {
  email: string | null;
  initial: UserSettings;
  next: string | null;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  const [displayName, setDisplayName] = useState(initial.displayName ?? "");

  const keysReady = hasRequiredApiKeys(
    Object.fromEntries(API_KEY_PROVIDERS.map((provider) => [provider, settings.apiKeys[provider].isSet])) as Record<
      ApiKeyProvider,
      boolean
    >
  );

  const [profileState, setProfileState] = useState<AsyncState>(IDLE);
  const [privacyState, setPrivacyState] = useState<AsyncState>(IDLE);
  const [keyDrafts, setKeyDrafts] = useState<Record<ApiKeyProvider, string>>(
    () => Object.fromEntries(API_KEY_PROVIDERS.map((provider) => [provider, ""])) as Record<ApiKeyProvider, string>
  );
  const [keyState, setKeyState] = useState<Partial<Record<ApiKeyProvider, AsyncState>>>({});

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteState, setDeleteState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileState({ busy: true, message: null, error: false });
    try {
      const updated = await patchSettings({ displayName: displayName.trim() || null });
      setSettings(updated);
      setProfileState({ busy: false, message: "Saved.", error: false });
    } catch (err) {
      setProfileState({ busy: false, message: err instanceof Error ? err.message : "Failed to save.", error: true });
    }
  }

  async function togglePublicScores(value: boolean) {
    setPrivacyState({ busy: true, message: null, error: false });
    try {
      const updated = await patchSettings({ shareScoresPublicly: value });
      setSettings(updated);
      setPrivacyState({ busy: false, message: null, error: false });
    } catch (err) {
      setPrivacyState({ busy: false, message: err instanceof Error ? err.message : "Failed to save.", error: true });
    }
  }

  async function saveKey(provider: ApiKeyProvider) {
    const value = keyDrafts[provider].trim();
    if (!value) return;
    setKeyState((prev) => ({ ...prev, [provider]: { busy: true, message: null, error: false } }));
    try {
      const updated = await patchSettings({ apiKeys: { [provider]: value } });
      setSettings(updated);
      setKeyDrafts((prev) => ({ ...prev, [provider]: "" }));
      setKeyState((prev) => ({ ...prev, [provider]: { busy: false, message: "Key saved.", error: false } }));
    } catch (err) {
      setKeyState((prev) => ({
        ...prev,
        [provider]: { busy: false, message: err instanceof Error ? err.message : "Failed to save.", error: true },
      }));
    }
  }

  async function removeKey(provider: ApiKeyProvider) {
    setKeyState((prev) => ({ ...prev, [provider]: { busy: true, message: null, error: false } }));
    try {
      const updated = await patchSettings({ apiKeys: { [provider]: null } });
      setSettings(updated);
      setKeyState((prev) => ({ ...prev, [provider]: { busy: false, message: "Key removed.", error: false } }));
    } catch (err) {
      setKeyState((prev) => ({
        ...prev,
        [provider]: { busy: false, message: err instanceof Error ? err.message : "Failed to remove.", error: true },
      }));
    }
  }

  async function deleteAccount() {
    setDeleteState({ busy: true, error: null });
    try {
      const res = await fetch("/api/settings/account", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete your account.");
      router.push("/login");
      router.refresh();
    } catch (err) {
      setDeleteState({ busy: false, error: err instanceof Error ? err.message : "Could not delete your account." });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {next && (
        <div
          className={`rounded-2xl border p-4 sm:p-5 flex items-center justify-between gap-4 ${
            keysReady ? "border-success bg-success-soft" : "border-warning bg-warning-soft"
          }`}
        >
          <p className="text-sm">
            {keysReady
              ? "All set — you can continue now."
              : "Add an ElevenLabs key plus either a Gemini or an Anthropic key below to continue."}
          </p>
          {keysReady && (
            <Button size="sm" onClick={() => router.push(next)}>
              Continue
            </Button>
          )}
        </div>
      )}

      <Card title="Profile">
        <form onSubmit={saveProfile} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Display name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className={textInputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Email</span>
            <input value={email ?? ""} disabled className={`${textInputClass} opacity-60 cursor-not-allowed`} />
          </label>
          {profileState.message && <Banner tone={profileState.error ? "error" : "success"}>{profileState.message}</Banner>}
          <Button type="submit" size="sm" disabled={profileState.busy} className="self-start">
            {profileState.busy ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </Card>

      <Card
        title="AI API keys"
        description="This app has no shared fallback key — interviews, grading, and voice all run on your own keys. Keys are encrypted at rest and never shown again after saving."
      >
        {API_KEY_PROVIDERS.map((provider) => {
          const label = API_KEY_PROVIDER_META[provider];
          const current = settings.apiKeys[provider];
          const state = keyState[provider];
          return (
            <div key={provider} className="flex flex-col gap-2 border-b border-border pb-5 last:border-0 last:pb-0">
              <div>
                <span className="block text-sm font-medium">{label.label}</span>
                <span className="block text-sm text-muted">{label.hint}</span>
              </div>
              {current.isSet && (
                <p className="text-sm text-muted">
                  Current key: <span className="font-mono">{current.masked ?? "saved"}</span>
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="password"
                  value={keyDrafts[provider]}
                  onChange={(e) => setKeyDrafts((prev) => ({ ...prev, [provider]: e.target.value }))}
                  placeholder={current.isSet ? "Replace key…" : "Paste API key…"}
                  autoComplete="off"
                  className={textInputClass}
                />
                <div className="flex gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={state?.busy || !keyDrafts[provider].trim()}
                    onClick={() => saveKey(provider)}
                  >
                    Save
                  </Button>
                  {current.isSet && (
                    <Button type="button" size="sm" variant="ghost" disabled={state?.busy} onClick={() => removeKey(provider)}>
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              {state?.message && <Banner tone={state.error ? "error" : "success"}>{state.message}</Banner>}
            </div>
          );
        })}
      </Card>

      <Card title="Privacy">
        <Toggle
          checked={settings.shareScoresPublicly}
          onChange={togglePublicScores}
          label="Share my scores publicly"
          description="Let other users see your interview scores on a public leaderboard."
        />
        {privacyState.message && <Banner tone={privacyState.error ? "error" : "success"}>{privacyState.message}</Banner>}
        {privacyState.busy && <p className="text-sm text-muted">Saving…</p>}
      </Card>

      <Card title="Danger zone" description="Permanently delete your account and all associated data.">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Type <span className="font-mono">delete</span> to confirm</span>
          <input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="delete"
            className={textInputClass}
          />
        </label>
        {deleteState.error && <Banner tone="error">{deleteState.error}</Banner>}
        <Button
          type="button"
          variant="danger"
          size="sm"
          disabled={deleteConfirm.trim().toLowerCase() !== "delete" || deleteState.busy}
          onClick={deleteAccount}
          className="self-start"
        >
          {deleteState.busy ? "Deleting…" : "Delete my account"}
        </Button>
      </Card>
    </div>
  );
}
