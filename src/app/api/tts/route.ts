import { NextResponse } from "next/server";

export const maxDuration = 30;

/**
 * Proxies text-to-speech to ElevenLabs. The API key stays on the server.
 * A 204 tells the client to fall back to the browser's speech synthesis,
 * which is what makes voice work with no keys configured at all.
 */
export async function POST(request: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return new NextResponse(null, { status: 204 });

  const body = (await request.json().catch(() => ({}))) as { text?: unknown };
  const text = String(body.text ?? "").trim().slice(0, 1500);
  if (!text) {
    return NextResponse.json({ error: "text is required." }, { status: 400 });
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || "pNInz6obpgDQGcFmaJgB";
  const model = process.env.ELEVENLABS_MODEL?.trim() || "eleven_turbo_v2_5";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "content-type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.1 },
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      console.error("[tts] elevenlabs failed:", response.status, await response.text());
      // Fall back to the browser voice rather than leaving the interviewer mute.
      return new NextResponse(null, { status: 204 });
    }

    const audio = await response.arrayBuffer();
    return new NextResponse(audio, {
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("[tts] request failed:", error);
    return new NextResponse(null, { status: 204 });
  } finally {
    clearTimeout(timer);
  }
}
