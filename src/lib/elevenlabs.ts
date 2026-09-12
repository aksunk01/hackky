const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // "Rachel", a stock ElevenLabs voice

export function hasElevenLabsKey(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

export async function synthesizeSpeech(text: string): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not configured.");

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_flash_v2_5",
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${errText.slice(0, 500)}`);
  }

  return res.arrayBuffer();
}
