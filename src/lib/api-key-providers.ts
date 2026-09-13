/**
 * Plain (non-server-only) module so client components — the signup key prompt
 * and the settings page — can share this with server code like users.ts
 * without pulling in Firestore/crypto into the client bundle.
 */
export type ApiKeyProvider = "gemini" | "anthropic" | "elevenlabs";
export const API_KEY_PROVIDERS: ApiKeyProvider[] = ["gemini", "anthropic", "elevenlabs"];

/** Single source of truth for how each provider's key is described in the UI (login prompt, settings page). */
export const API_KEY_PROVIDER_META: Record<ApiKeyProvider, { label: string; hint: string }> = {
  gemini: { label: "Google Gemini API key", hint: "Powers interview grading and problem generation." },
  anthropic: { label: "Anthropic API key", hint: "Powers the AI interviewer's follow-up questions." },
  elevenlabs: { label: "ElevenLabs API key", hint: "Powers text-to-speech during voice interviews." },
};

/** Interviews need one text-AI provider (either works) plus ElevenLabs for voice — not all three. */
export function hasRequiredApiKeys(isSet: Record<ApiKeyProvider, boolean>): boolean {
  return isSet.elevenlabs && (isSet.gemini || isSet.anthropic);
}
