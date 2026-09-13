import * as claude from "@/lib/claude";
import * as gemini from "@/lib/gemini";
import type { ChatTurn } from "@/lib/gemini";

export type { ChatTurn };
export type AiProvider = "gemini" | "claude";

export const DEFAULT_AI_PROVIDER: AiProvider = "gemini";

export function isAiProvider(value: unknown): value is AiProvider {
  return value === "gemini" || value === "claude";
}

export function aiProviderLabel(provider: AiProvider): string {
  return provider === "claude" ? "Claude" : "Gemini";
}

export function hasProviderKey(provider: AiProvider): boolean {
  return provider === "claude" ? claude.hasClaudeKey() : gemini.hasGeminiKey();
}

export function isProviderQuotaError(provider: AiProvider, error: unknown): boolean {
  return provider === "claude" ? claude.isQuotaError(error) : gemini.isQuotaError(error);
}

export function generateText(
  provider: AiProvider,
  systemInstruction: string,
  history: ChatTurn[]
): Promise<string | null> {
  return provider === "claude"
    ? claude.generateText(systemInstruction, history)
    : gemini.generateText(systemInstruction, history);
}

export function generateJson<T>(
  provider: AiProvider,
  systemInstruction: string,
  history: ChatTurn[]
): Promise<T | null> {
  return provider === "claude"
    ? claude.generateJson<T>(systemInstruction, history)
    : gemini.generateJson<T>(systemInstruction, history);
}

/** Builds the query string a problem link carries into the interview page. */
export function aiProviderToQuery(provider: AiProvider): string {
  return provider === DEFAULT_AI_PROVIDER ? "" : `provider=${provider}`;
}

/** Reads the AI provider a problem link was opened with, defaulting to Gemini. */
export function aiProviderFromSearch(search: string): AiProvider {
  const value = new URLSearchParams(search).get("provider");
  return isAiProvider(value) ? value : DEFAULT_AI_PROVIDER;
}
