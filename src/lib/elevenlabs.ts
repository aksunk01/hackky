import { ElevenLabsClient, ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { createKeyedClientCache } from "@/lib/client-cache";

/**
 * Sarah, a `premade` voice that works on free plans. The originally configured
 * voice, Veda Sky (XcXEQzuLXRU9RcfWzEJt), is a `professional` Voice Library
 * voice that the API rejects with 402 unless the subscription covers it — set
 * ELEVENLABS_VOICE_ID to switch back once it does.
 */
export const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL";
export const TTS_MODEL_ID = "eleven_flash_v2_5";
export const STT_MODEL_ID = "scribe_v2";

export function hasElevenLabsKey(apiKey?: string | null): boolean {
  return Boolean(apiKey);
}

const cachedClientFor = createKeyedClientCache((apiKey: string) => new ElevenLabsClient({ apiKey }));

export function getClient(apiKey?: string | null): ElevenLabsClient | null {
  return apiKey ? cachedClientFor(apiKey) : null;
}

/** Turns an ElevenLabs SDK failure into a status code plus a safe message. */
export function describeError(error: unknown): { status: number; message: string } {
  if (error instanceof ElevenLabsError) {
    return {
      status: error.statusCode ?? 502,
      message: error.message || "ElevenLabs request failed",
    };
  }
  return { status: 500, message: "Internal server error" };
}

export const MISSING_KEY_MESSAGE =
  "No ElevenLabs API key on your account — add one in Settings to enable voice.";
