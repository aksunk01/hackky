"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  type UserCredential,
} from "firebase/auth";
import { auth } from "@/lib/firebase-client";
import { Button, Logo } from "@/components/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  API_KEY_PROVIDERS,
  API_KEY_PROVIDER_META,
  hasRequiredApiKeys,
  type ApiKeyProvider,
} from "@/lib/api-key-providers";
import { patchSettings } from "@/lib/settings-client";

const FRIENDLY_ERRORS: Record<string, string> = {
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/user-not-found": "No account found with that email.",
  "auth/wrong-password": "Incorrect password.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/email-already-in-use": "An account already exists with that email.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/popup-closed-by-user": "Google sign-in was closed before finishing.",
};

function friendlyError(error: unknown): string {
  const code = (error as { code?: string }).code;
  if (code && FRIENDLY_ERRORS[code]) return FRIENDLY_ERRORS[code];
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/problems";

  const [step, setStep] = useState<"credentials" | "keys">("credentials");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [keys, setKeys] = useState<Record<ApiKeyProvider, string>>(
    () => Object.fromEntries(API_KEY_PROVIDERS.map((provider) => [provider, ""])) as Record<ApiKeyProvider, string>
  );
  const [keysError, setKeysError] = useState("");
  const [keysBusy, setKeysBusy] = useState(false);

  async function establishSession(cred: UserCredential, isNewUser: boolean) {
    const idToken = await cred.user.getIdToken();
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) throw new Error("Could not start your session. Try again.");
    if (isNewUser) {
      setBusy(false);
      setStep("keys");
      return;
    }
    router.push(next);
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const cred =
        mode === "signin"
          ? await signInWithEmailAndPassword(auth, email, password)
          : await createUserWithEmailAndPassword(auth, email, password);
      await establishSession(cred, mode === "signup");
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setError("");
    setBusy(true);
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      const isNewUser = getAdditionalUserInfo(cred)?.isNewUser ?? false;
      await establishSession(cred, isNewUser);
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  async function saveKeysAndContinue(e: React.FormEvent) {
    e.preventDefault();
    setKeysError("");
    const filled = Object.fromEntries(
      API_KEY_PROVIDERS.map((provider) => [provider, Boolean(keys[provider].trim())])
    ) as Record<ApiKeyProvider, boolean>;
    if (!hasRequiredApiKeys(filled)) {
      setKeysError("An ElevenLabs key plus either a Gemini or an Anthropic key are required — this app has no shared fallback key.");
      return;
    }
    setKeysBusy(true);
    try {
      const apiKeys = Object.fromEntries(
        API_KEY_PROVIDERS.filter((provider) => keys[provider].trim()).map((provider) => [provider, keys[provider].trim()])
      );
      await patchSettings({ apiKeys });
      router.push(next);
      router.refresh();
    } catch (err) {
      setKeysError(err instanceof Error ? err.message : "Could not save your keys.");
      setKeysBusy(false);
    }
  }

  if (step === "keys") {
    return (
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center">
            <Logo />
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <h1 className="text-lg font-semibold">Add your AI API keys</h1>
            <p className="mt-1 text-sm text-muted">
              This app doesn&apos;t provide shared API keys — bring your own. You need an ElevenLabs key for voice,
              plus either a Gemini or an Anthropic key for the interview itself. You can update these later in
              Settings.
            </p>
            <form onSubmit={saveKeysAndContinue} className="mt-5 flex flex-col gap-3">
              {API_KEY_PROVIDERS.map((provider) => (
                <div key={provider} className="flex flex-col gap-1.5">
                  <Label htmlFor={`signup-key-${provider}`}>
                    {API_KEY_PROVIDER_META[provider].label}
                    {provider === "gemini" && <span className="text-muted font-normal"> (or Anthropic)</span>}
                    {provider === "anthropic" && <span className="text-muted font-normal"> (or Gemini)</span>}
                  </Label>
                  <Input
                    id={`signup-key-${provider}`}
                    type="password"
                    value={keys[provider]}
                    onChange={(e) => setKeys((prev) => ({ ...prev, [provider]: e.target.value }))}
                    placeholder="Paste API key…"
                    autoComplete="off"
                    required={provider === "elevenlabs"}
                  />
                  <span className="text-xs text-muted">{API_KEY_PROVIDER_META[provider].hint}</span>
                </div>
              ))}

              {keysError && <p className="text-sm text-danger">{keysError}</p>}

              <Button type="submit" disabled={keysBusy} className="w-full mt-1">
                {keysBusy ? "Saving…" : "Save keys & continue"}
              </Button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          <Tabs value={mode} onValueChange={(value) => setMode(value as "signin" | "signup")} className="mb-6">
            <TabsList className="w-full rounded-full bg-subtle p-1">
              <TabsTrigger value="signin" className="rounded-full data-active:bg-card data-active:shadow-sm">
                Sign in
              </TabsTrigger>
              <TabsTrigger value="signup" className="rounded-full data-active:bg-card data-active:shadow-sm">
                Create account
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              autoComplete="email"
            />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />

            {mode === "signup" && (
              <p className="text-xs text-muted">
                Next, you&apos;ll be asked for your own ElevenLabs key plus either a Gemini or an Anthropic key — this
                app has no shared fallback key.
              </p>
            )}

            {error && <p className="text-sm text-danger">{error}</p>}

            <Button type="submit" disabled={busy} className="w-full mt-1">
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={googleSignIn}
            className="w-full"
          >
            Continue with Google
          </Button>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
