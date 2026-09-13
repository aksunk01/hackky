import { NextResponse } from "next/server";
import {
  hasElevenLabsKey,
  STT_MODEL_ID,
  TTS_MODEL_ID,
  VOICE_ID,
} from "@/lib/elevenlabs";
import { getCurrentUserApiKey } from "@/lib/users";

/** Quick check that voice is configured, without spending an API call. */
export async function GET() {
  const userApiKey = await getCurrentUserApiKey("elevenlabs");
  return NextResponse.json({
    ok: hasElevenLabsKey(userApiKey),
    voiceId: VOICE_ID,
    ttsModel: TTS_MODEL_ID,
    sttModel: STT_MODEL_ID,
  });
}
