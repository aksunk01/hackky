// ---------------------------------------------------------------------------
// A small provider-agnostic chat surface. The interviewer agent is written
// against this, so swapping the model provider never touches agent logic.
// ---------------------------------------------------------------------------

export interface JsonSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
}

export interface LlmTool {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface LlmToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export type LlmMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: LlmToolCall[] }
  | { role: "tool"; results: { id: string; name: string; result: unknown }[] };

export interface ChatRequest {
  system: string;
  messages: LlmMessage[];
  tools?: LlmTool[];
  temperature?: number;
  maxTokens?: number;
  /** Ask the provider for raw JSON back, where it supports it. */
  json?: boolean;
}

export interface LlmResponse {
  text: string;
  toolCalls: LlmToolCall[];
}

export interface LlmProvider {
  readonly id: "gemini" | "anthropic";
  readonly model: string;
  chat(request: ChatRequest): Promise<LlmResponse>;
}

export class LlmError extends Error {
  // Written as a plain field rather than a constructor parameter property, so
  // the file stays erasable-syntax-only and runnable by plain `node`.
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "LlmError";
    this.status = status;
  }
}

/** fetch with a hard timeout, since a hung model call would stall the interview. */
export async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs = 30_000,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      throw new LlmError(
        `${response.status} ${response.statusText}: ${text.slice(0, 500)}`,
        response.status,
      );
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new LlmError(`Provider returned non-JSON: ${text.slice(0, 200)}`);
    }
  } catch (err) {
    if (err instanceof LlmError) throw err;
    if ((err as Error).name === "AbortError") {
      throw new LlmError(`Model call timed out after ${timeoutMs}ms`);
    }
    throw new LlmError((err as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Models wrap JSON in prose or code fences often enough that parsing has to be
 * forgiving. Falls back to the outermost balanced {...} in the text.
 */
export function extractJson<T>(text: string): T | null {
  const trimmed = text.trim();
  const candidates: string[] = [];

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) candidates.push(fenced[1]);
  candidates.push(trimmed);

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(trimmed.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate.trim()) as T;
    } catch {
      // try the next shape
    }
  }
  return null;
}
