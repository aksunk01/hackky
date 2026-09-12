import { NextResponse } from "next/server";
import { hasElevenLabsKey, synthesizeSpeech } from "@/lib/elevenlabs";

export async function POST(request: Request) {
  if (!hasElevenLabsKey()) {
    return NextResponse.json({ error: "ElevenLabs is not configured." }, { status: 501 });
  }

  const body = await request.json();
  const { text } = body as { text?: string };
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text is required." }, { status: 400 });
  }

  try {
    const audio = await synthesizeSpeech(text);
    return new NextResponse(audio, {
      headers: { "Content-Type": "audio/mpeg" },
    });
  } catch (err) {
    console.error("ElevenLabs speech synthesis failed:", err);
    return NextResponse.json({ error: "Speech synthesis failed." }, { status: 502 });
  }
}
