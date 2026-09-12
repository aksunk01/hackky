import { ApiError, GoogleGenAI } from "@google/genai";

/**
 * The free tier allows 20 generate_content requests *per day, per model*, and
 * an interview burns those in minutes — every utterance, run and idle code
 * review is a call — which silently demotes the interviewer to scripted
 * replies. The -lite models carry a larger allowance, so they outlast a demo
 * where plain 3.5-flash and 3.6-flash do not. Each model has its own daily
 * bucket, so switching GEMINI_MODEL also buys a fresh one; note gemini-2.5-*
 * is now retired and 404s.
 */
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";

/** Transient failures worth another try: quota bounces and backend blips. */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503]);
/** One retry. A quota wait is ~13s, and an interview reply can't stall forever. */
const MAX_ATTEMPTS = 2;

let cachedClient: GoogleGenAI | null = null;

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!cachedClient) cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

export type ChatTurn = { role: "user" | "model"; text: string };

/**
 * Whether a failure is the free tier's rate limit rather than a real fault.
 * Callers surface this differently: the key works, there's just no quota left
 * this minute, and pretending otherwise looks like the model ignoring input.
 */
export function isQuotaError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 429;
}

/**
 * How long to wait before retrying, or null if the failure won't fix itself.
 * A quota bounce comes back with the wait baked into the message, so honour
 * that rather than guessing at it.
 */
function retryDelayMs(error: unknown, attempt: number): number | null {
  if (!(error instanceof ApiError) || !RETRYABLE_STATUSES.has(error.status)) {
    return null;
  }
  const suggested = /retry in ([\d.]+)\s*s/i.exec(error.message);
  const ms = suggested ? Number(suggested[1]) * 1000 + 250 : 700 * 2 ** attempt;
  return Math.min(ms, 15_000);
}

async function withRetry<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      const delay =
        attempt + 1 < MAX_ATTEMPTS ? retryDelayMs(error, attempt) : null;
      if (delay === null) throw error;
      console.warn(`[gemini] transient failure; retrying in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function generateText(
  systemInstruction: string,
  history: ChatTurn[]
): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  const response = await withRetry(() =>
    client.models.generateContent({
      model: MODEL,
      contents: history.map((turn) => ({
        role: turn.role,
        parts: [{ text: turn.text }],
      })),
      config: { systemInstruction },
    })
  );

  return response.text ?? null;
}

export async function generateJson<T>(
  systemInstruction: string,
  history: ChatTurn[]
): Promise<T | null> {
  const client = getClient();
  if (!client) return null;

  const response = await withRetry(() =>
    client.models.generateContent({
      model: MODEL,
      contents: history.map((turn) => ({
        role: turn.role,
        parts: [{ text: turn.text }],
      })),
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      },
    })
  );

  const text = response.text;
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
