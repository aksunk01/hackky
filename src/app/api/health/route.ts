import { NextResponse } from "next/server";
import { checkToolchains } from "@/lib/runner";
import { getProvider } from "@/lib/llm";
import { PROBLEMS } from "@/lib/problems";

export const dynamic = "force-dynamic";

export async function GET() {
  const provider = getProvider();
  const toolchains = await checkToolchains();

  return NextResponse.json({
    ok: true,
    interviewer: provider
      ? { mode: "model", provider: provider.id, model: provider.model }
      : { mode: "offline", provider: null, model: null },
    voice: {
      tts: process.env.ELEVENLABS_API_KEY ? "elevenlabs" : "browser",
      stt: "browser",
    },
    toolchains,
    problems: PROBLEMS.length,
  });
}
