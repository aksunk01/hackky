"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

/** Thin wrapper so every settings section shares one shadcn Card layout. */
function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-6 sm:p-8">
      <CardHeader className="p-0">
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="p-0 mt-5 flex flex-col gap-5">{children}</CardContent>
    </Card>
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
        <Alert className={keysReady ? "border-success bg-success-soft" : "border-warning bg-warning-soft"}>
          <AlertDescription className="flex items-center justify-between gap-4 text-foreground">
            <span>
              {keysReady
                ? "All set — you can continue now."
                : "Add an ElevenLabs key plus either a Gemini or an Anthropic key below to continue."}
            </span>
            {keysReady && (
              <Button size="sm" onClick={() => router.push(next)}>
                Continue
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      <SectionCard title="Profile">
        <form onSubmit={saveProfile} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email ?? ""} disabled className="opacity-60 cursor-not-allowed" />
          </div>
          {profileState.message && <Banner tone={profileState.error ? "error" : "success"}>{profileState.message}</Banner>}
          <Button type="submit" size="sm" disabled={profileState.busy} className="self-start">
            {profileState.busy ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </SectionCard>

      <SectionCard
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
                <Label htmlFor={`key-${provider}`}>{label.label}</Label>
                <p className="text-sm text-muted">{label.hint}</p>
              </div>
              {current.isSet && (
                <p className="text-sm text-muted">
                  Current key: <span className="font-mono">{current.masked ?? "saved"}</span>
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  id={`key-${provider}`}
                  type="password"
                  value={keyDrafts[provider]}
                  onChange={(e) => setKeyDrafts((prev) => ({ ...prev, [provider]: e.target.value }))}
                  placeholder={current.isSet ? "Replace key…" : "Paste API key…"}
                  autoComplete="off"
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
      </SectionCard>

      <SectionCard title="Privacy">
        <div className="flex w-full items-start justify-between gap-4">
          <Label htmlFor="share-scores" className="flex flex-col items-start gap-1 font-normal">
            <span className="text-sm font-medium">Share my scores publicly</span>
            <span className="text-sm text-muted">Let other users see your interview scores on a public leaderboard.</span>
          </Label>
          <Switch id="share-scores" checked={settings.shareScoresPublicly} onCheckedChange={togglePublicScores} />
        </div>
        {privacyState.message && <Banner tone={privacyState.error ? "error" : "success"}>{privacyState.message}</Banner>}
        {privacyState.busy && <p className="text-sm text-muted">Saving…</p>}
      </SectionCard>

      <SectionCard title="Danger zone" description="Permanently delete your account and all associated data.">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="delete-confirm">
            Type <span className="font-mono">delete</span> to confirm
          </Label>
          <Input
            id="delete-confirm"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="delete"
          />
        </div>
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
      </SectionCard>
    </div>
  );
}
