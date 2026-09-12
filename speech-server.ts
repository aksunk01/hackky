import { Readable } from "node:stream";

import { ElevenLabsClient, ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import cors from "cors";
import "dotenv/config";
import express from "express";

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  throw new Error("ELEVENLABS_API_KEY is missing — add it to .env");
}

const PORT = Number(process.env.PORT ?? 3000);
// Sarah, a `premade` voice that works on free plans. The originally configured
// voice, Veda Sky (XcXEQzuLXRU9RcfWzEJt), is a `professional` Voice Library
// voice that the API rejects with 402 unless the subscription covers it — set
// ELEVENLABS_VOICE_ID to switch back once it does.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "EXAVITQu4vr4xnSDxMaL";
const TTS_MODEL_ID = "eleven_flash_v2_5";
const STT_MODEL_ID = "scribe_v2";

const elevenlabs = new ElevenLabsClient({ apiKey: API_KEY });

const app = express();
app.use(cors());

/** Turns an ElevenLabs SDK failure into a status code plus a safe message. */
function describeError(error: unknown): { status: number; message: string } {
  if (error instanceof ElevenLabsError) {
    return {
      status: error.statusCode ?? 502,
      message: error.message || "ElevenLabs request failed",
    };
  }
  return { status: 500, message: "Internal server error" };
}

app.post("/api/stream-speech", express.json({ limit: "1mb" }), async (req, res) => {
  const { text } = req.body as { text?: unknown };

  if (typeof text !== "string" || text.trim() === "") {
    res.status(400).json({ error: "Body must include a non-empty `text` string" });
    return;
  }

  try {
    const audio = await elevenlabs.textToSpeech.stream(VOICE_ID, {
      text,
      modelId: TTS_MODEL_ID,
      outputFormat: "mp3_44100_128",
    });

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");

    // `stream()` hands back a web ReadableStream; Readable.fromWeb bridges it to
    // the Node response so audio forwards chunk-by-chunk instead of buffering.
    const nodeStream = Readable.fromWeb(audio as import("node:stream/web").ReadableStream<Uint8Array>);

    // If the client hangs up mid-playback, stop pulling from ElevenLabs.
    res.on("close", () => nodeStream.destroy());

    nodeStream.on("error", (error) => {
      console.error("[stream-speech] stream error:", error);
      res.destroy();
    });

    nodeStream.pipe(res);
  } catch (error) {
    console.error("[stream-speech] failed:", error);
    // Headers only go out once the stream is open, so a failure here is still reportable.
    if (!res.headersSent) {
      const { status, message } = describeError(error);
      res.status(status).json({ error: message });
    } else {
      res.destroy();
    }
  }
});

app.post(
  "/api/transcribe-audio",
  express.raw({ type: () => true, limit: "50mb" }),
  async (req, res) => {
    const audio = req.body as Buffer;

    if (!Buffer.isBuffer(audio) || audio.length === 0) {
      res.status(400).json({ error: "Request body must contain raw audio bytes" });
      return;
    }

    const contentType = req.get("content-type") ?? "application/octet-stream";

    try {
      const transcription = await elevenlabs.speechToText.convert({
        modelId: STT_MODEL_ID,
        file: {
          data: audio,
          filename: "audio",
          contentType,
          contentLength: audio.length,
        },
      });

      res.json({
        text: transcription.text,
        languageCode: transcription.languageCode,
      });
    } catch (error) {
      console.error("[transcribe-audio] failed:", error);
      const { status, message } = describeError(error);
      res.status(status).json({ error: message });
    }
  }
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, voiceId: VOICE_ID, ttsModel: TTS_MODEL_ID, sttModel: STT_MODEL_ID });
});

app.listen(PORT, () => {
  console.log(`Speech server listening on http://localhost:${PORT}`);
});
