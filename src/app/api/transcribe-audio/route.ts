import { NextResponse } from "next/server";
import {
  describeError,
  getClient,
  MISSING_KEY_MESSAGE,
  STT_MODEL_ID,
} from "@/lib/elevenlabs";
import { getCurrentUserApiKey } from "@/lib/users";

export async function POST(request: Request) {
  const userApiKey = await getCurrentUserApiKey("elevenlabs");
  const client = getClient(userApiKey);
  if (!client) {
    return NextResponse.json({ error: MISSING_KEY_MESSAGE }, { status: 503 });
  }

  const audio = Buffer.from(await request.arrayBuffer());

  if (audio.length === 0) {
    return NextResponse.json(
      { error: "Request body must contain raw audio bytes" },
      { status: 400 }
    );
  }

  // Forwarded as the upload's content type, so it has to be the container
  // MediaRecorder actually produced.
  const contentType = request.headers.get("content-type") ?? "application/octet-stream";

  try {
    const transcription = await client.speechToText.convert({
      modelId: STT_MODEL_ID,
      file: {
        data: audio,
        filename: "audio",
        contentType,
        contentLength: audio.length,
      },
    });

    return NextResponse.json({
      text: transcription.text,
      languageCode: transcription.languageCode,
    });
  } catch (error) {
    console.error("[transcribe-audio] failed:", error);
    const { status, message } = describeError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
