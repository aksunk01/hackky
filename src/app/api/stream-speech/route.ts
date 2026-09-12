import { NextResponse } from "next/server";
import {
  describeError,
  getClient,
  MISSING_KEY_MESSAGE,
  TTS_MODEL_ID,
  VOICE_ID,
} from "@/lib/elevenlabs";

async function synthesize(text: string): Promise<Response> {
  const client = getClient();
  if (!client) {
    return NextResponse.json({ error: MISSING_KEY_MESSAGE }, { status: 503 });
  }

  if (text.trim() === "") {
    return NextResponse.json(
      { error: "`text` must be a non-empty string" },
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

/**
 * GET so an `<audio>` element can point straight at this URL: the browser
 * then streams and plays progressively as bytes arrive, instead of the
 * client having to buffer the whole reply before a single sample can play.
 * Text rides in the query string, so voice.ts only takes this path for
 * replies short enough to fit one — anything longer uses `POST` below.
 */
export async function GET(request: Request) {
  const text = new URL(request.url).searchParams.get("text") ?? "";
  return synthesize(text);
}

/** Fallback for text too long to fit a URL: buffered rather than streamed. */
export async function POST(request: Request) {
  const { text } = (await request.json()) as { text?: unknown };
  return synthesize(typeof text === "string" ? text : "");
}
