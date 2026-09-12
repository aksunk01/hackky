import type { LlmProvider } from "./provider";
import { createGeminiProvider } from "./gemini";
import { createAnthropicProvider } from "./anthropic";

export * from "./provider";

/**
 * Picks a provider from the environment. The README specifies Gemini, so it
 * wins when both keys are present; LLM_PROVIDER overrides either way.
 * Returns null when no key is configured, which puts the whole app into its
 * offline rule-based mode rather than failing.
 */
export function getProvider(): LlmProvider | null {
  const forced = (process.env.LLM_PROVIDER ?? "").trim().toLowerCase();
  const gemini = (process.env.GEMINI_API_KEY ?? "").trim();
  const anthropic = (process.env.ANTHROPIC_API_KEY ?? "").trim();

  if (forced === "none") return null;

  if (forced === "gemini" || (!forced && gemini)) {
    if (!gemini) return null;
    return createGeminiProvider(gemini, process.env.GEMINI_MODEL || "gemini-2.5-flash");
  }

  if (forced === "anthropic" || (!forced && anthropic)) {
    if (!anthropic) return null;
    return createAnthropicProvider(
      anthropic,
      process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    );
  }

  return null;
}

export function providerLabel(): string {
  const provider = getProvider();
  return provider ? `${provider.id}:${provider.model}` : "offline";
}
