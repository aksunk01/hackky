"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { problems, type Problem } from "@/lib/problems";
import { DifficultyBadge, SiteHeader } from "@/components/ui";
import {
  DEFAULT_STRICT_MINUTES,
  DEV_STRICT_MINUTES,
  STRICT_DURATION_OPTIONS,
  timerConfigToQuery,
  type TimerMode,
} from "@/lib/timer";

const isDev = process.env.NODE_ENV !== "production";

const DIFFICULTIES: Problem["difficulty"][] = ["Easy", "Medium", "Hard"];

const difficultyChipTone: Record<Problem["difficulty"], string> = {
  Easy: "border-success text-success bg-success-soft",
  Medium: "border-warning text-warning bg-warning-soft",
  Hard: "border-danger text-danger bg-danger-soft",
};

export default function ProblemsPage() {
  const [query, setQuery] = useState("");
  const [activeDifficulties, setActiveDifficulties] = useState<Problem["difficulty"][]>([]);
  const [timerMode, setTimerMode] = useState<TimerMode>("countup");
  const [strictMinutes, setStrictMinutes] = useState(DEFAULT_STRICT_MINUTES);

  const timerQuery = timerConfigToQuery({ mode: timerMode, minutes: strictMinutes });

  function toggleDifficulty(d: Problem["difficulty"]) {
    setActiveDifficulties((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return problems.filter((p) => {
      const matchesQuery =
        !q || p.title.toLowerCase().includes(q) || p.tags.toLowerCase().includes(q);
      const matchesDifficulty =
        activeDifficulties.length === 0 || activeDifficulties.includes(p.difficulty);
      return matchesQuery && matchesDifficulty;
    });
  }, [query, activeDifficulties]);

  const hasFilters = query.trim() !== "" || activeDifficulties.length > 0;

  return (
    <main className="flex-1 flex flex-col">
      <SiteHeader active="practice" />

      <div className="max-w-3xl w-full mx-auto px-6 py-14 sm:py-16 flex-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Choose a Problem</h1>
        <p className="text-muted mb-6">
          {problems.length} problem{problems.length === 1 ? "" : "s"} available — pick one to begin your interview.
        </p>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 mb-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Session Timer</span>
            <span className="text-xs text-muted">
              {timerMode === "strict"
                ? `Auto-submits after ${strictMinutes} min`
                : "Tracks elapsed time — no cutoff"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTimerMode("countup")}
              aria-pressed={timerMode === "countup"}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                timerMode === "countup"
                  ? "border-accent bg-accent-soft"
                  : "border-border-strong hover:bg-subtle"
              }`}
            >
              <div className="text-sm font-medium">Free timer</div>
              <div className="text-xs text-muted">Stopwatch counts up, no limit</div>
            </button>
            <button
              type="button"
              onClick={() => setTimerMode("strict")}
              aria-pressed={timerMode === "strict"}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                timerMode === "strict"
                  ? "border-accent bg-accent-soft"
                  : "border-border-strong hover:bg-subtle"
              }`}
            >
              <div className="text-sm font-medium">Strict time limit</div>
              <div className="text-xs text-muted">Auto-submits when time runs out</div>
            </button>
          </div>

          {timerMode === "strict" && (
            <div className="flex items-center gap-2 flex-wrap animate-fade-up">
              <span className="text-xs text-muted uppercase tracking-wide mr-1">Duration</span>
              {STRICT_DURATION_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setStrictMinutes(m)}
                  aria-pressed={strictMinutes === m}
                  className={`text-xs font-medium rounded-full border px-3 py-1.5 transition-colors ${
                    strictMinutes === m
                      ? "border-accent text-accent bg-accent-soft"
                      : "border-border-strong text-muted hover:text-foreground hover:bg-subtle"
                  }`}
                >
                  {m} min
                </button>
              ))}
              {isDev && (
                <button
                  type="button"
                  onClick={() => setStrictMinutes(DEV_STRICT_MINUTES)}
                  aria-pressed={strictMinutes === DEV_STRICT_MINUTES}
                  title="Dev-only: exercise the full countdown and auto-submit in under a minute"
                  className={`text-xs font-medium rounded-full border border-dashed px-3 py-1.5 transition-colors ${
                    strictMinutes === DEV_STRICT_MINUTES
                      ? "border-accent text-accent bg-accent-soft"
                      : "border-border-strong text-muted hover:text-foreground hover:bg-subtle"
                  }`}
                >
                  {DEV_STRICT_MINUTES} min (dev)
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <div className="relative">
            <span
              aria-hidden
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            >
              &#128269;
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or topic..."
              aria-label="Search problems"
              className="w-full rounded-full border border-border-strong bg-card pl-11 pr-4 py-2.5 text-sm outline-none focus:border-accent transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted uppercase tracking-wide mr-1">Difficulty</span>
            {DIFFICULTIES.map((d) => {
              const active = activeDifficulties.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDifficulty(d)}
                  aria-pressed={active}
                  className={`text-xs font-medium rounded-full border px-3 py-1.5 transition-colors ${
                    active
                      ? difficultyChipTone[d]
                      : "border-border-strong text-muted hover:text-foreground hover:bg-subtle"
                  }`}
                >
                  {d}
                </button>
              );
            })}
            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setActiveDifficulties([]);
                }}
                className="text-xs text-muted hover:text-foreground underline underline-offset-2 ml-1"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-strong px-5 py-10 text-center">
            <p className="text-muted">No problems match your filters.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((p) => (
              <Link
                key={p.id}
                href={`/interview/${p.id}${timerQuery}`}
                className="group flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 transition-all hover:border-accent hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="flex flex-col gap-1.5">
                  <div className="font-medium">{p.title}</div>
                  <div className="flex items-center gap-2 text-sm">
                    <DifficultyBadge level={p.difficulty} />
                    <span className="text-muted">{p.tags}</span>
                  </div>
                </div>
                <span className="text-muted/50 transition-transform group-hover:translate-x-0.5 group-hover:text-accent">
                  &rarr;
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
