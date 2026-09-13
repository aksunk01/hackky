import Anthropic, { APIError } from "@anthropic-ai/sdk";

const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5";

/** Transient failures worth another try: rate limits and backend blips. */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503]);
/** One retry — an interview reply can't stall forever. */
const MAX_ATTEMPTS = 2;

let cachedClient: Anthropic | null = null;

export function hasClaudeKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  if (!cachedClient) cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

export type ChatTurn = { role: "user" | "model"; text: string };

export function isQuotaError(error: unknown): boolean {
  return error instanceof APIError && error.status === 429;
}

function retryDelayMs(error: unknown, attempt: number): number | null {
  if (!(error instanceof APIError) || !error.status || !RETRYABLE_STATUSES.has(error.status)) {
    return null;
  }
  return Math.min(700 * 2 ** attempt, 15_000);
}

async function withRetry<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      const delay =
        attempt + 1 < MAX_ATTEMPTS ? retryDelayMs(error, attempt) : null;
      if (delay === null) throw error;
      console.warn(`[claude] transient failure; retrying in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

function toMessages(history: ChatTurn[]): Anthropic.MessageParam[] {
  return history.map((turn) => ({
    role: turn.role === "model" ? "assistant" : "user",
    content: turn.text,
  }));
}

function textFromResponse(response: Anthropic.Message): string | null {
  const block = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === "text"
  );
  return block?.text ?? null;
}

export async function generateText(
  systemInstruction: string,
  history: ChatTurn[]
): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  const response = await withRetry(() =>
    client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemInstruction,
      messages: toMessages(history),
      // Spoken, latency-sensitive replies — keep thinking shallow.
      output_config: { effort: "low" },
    })
  );

  return textFromResponse(response);
}

export async function generateJson<T>(
  systemInstruction: string,
  history: ChatTurn[]
): Promise<T | null> {
  const client = getClient();
  if (!client) return null;

  const response = await withRetry(() =>
    client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: systemInstruction,
      messages: toMessages(history),
    })
  );

  const text = textFromResponse(response);
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
