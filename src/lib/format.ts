import type { Difficulty, EventKind, Language } from "@/lib/types";

/** mm:ss for a duration in milliseconds. Safe on both server and client. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  easy: "text-accent border-accent/30 bg-accent/10",
  medium: "text-warn border-warn/30 bg-warn/10",
  hard: "text-bad border-bad/30 bg-bad/10",
};

export const EVENT_STYLE: Record<EventKind, { dot: string; text: string; icon: string }> = {
  good: { dot: "bg-accent", text: "text-accent", icon: "●" },
  warn: { dot: "bg-warn", text: "text-warn", icon: "●" },
  bad: { dot: "bg-bad", text: "text-bad", icon: "●" },
  hint: { dot: "bg-hint", text: "text-hint", icon: "◆" },
  info: { dot: "bg-faint", text: "text-muted", icon: "○" },
};

export const LANGUAGE_LABEL: Record<Language, string> = {
  java: "Java",
  python: "Python",
  javascript: "JavaScript",
};

/** Monaco's language identifier for each supported language. */
export const MONACO_LANGUAGE: Record<Language, string> = {
  java: "java",
  python: "python",
  javascript: "javascript",
};

/** Renders `inline code` spans inside problem prose without a markdown dependency. */
export function renderInlineCode(text: string): { code: boolean; text: string }[] {
  return text.split(/(`[^`]+`)/g).filter(Boolean).map((part) =>
    part.startsWith("`") && part.endsWith("`") && part.length > 2
      ? { code: true, text: part.slice(1, -1) }
      : { code: false, text: part },
  );
}
