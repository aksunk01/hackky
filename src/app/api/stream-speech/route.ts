import { NextResponse } from "next/server";
import {
  describeError,
  getClient,
  MISSING_KEY_MESSAGE,
  TTS_MODEL_ID,
  VOICE_ID,
} from "@/lib/elevenlabs";

export async function POST(request: Request) {
  const client = getClient();
  if (!client) {
    return NextResponse.json({ error: MISSING_KEY_MESSAGE }, { status: 503 });
  }

  const { text } = (await request.json()) as { text?: unknown };

  if (typeof text !== "string" || text.trim() === "") {
    return NextResponse.json(
      { error: "Body must include a non-empty `text` string" },
      { status: 400 }
    );
  }

  try {
    // `stream()` hands back a web ReadableStream, which is exactly what a
    // Response body takes — audio forwards chunk-by-chunk instead of
    // buffering, and a client hang-up cancels the stream back to ElevenLabs.
    const audio = await client.textToSpeech.stream(VOICE_ID, {
      text,
      modelId: TTS_MODEL_ID,
      outputFormat: "mp3_44100_128",
    });

    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[stream-speech] failed:", error);
    const { status, message } = describeError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
