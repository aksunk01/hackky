"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Difficulty, InterviewStyle, Language } from "@/lib/types";
import { DIFFICULTY_STYLE } from "@/lib/format";

interface ProblemSummary {
  id: string;
  title: string;
  difficulty: Difficulty;
  category: string;
  blurb: string;
  visibleTests: number;
  hiddenTests: number;
}

interface Health {
  interviewer: { mode: string; provider: string | null; model: string | null };
  voice: { tts: string; stt: string };
  toolchains: Record<Language, boolean>;
}

const LANGUAGES: { id: Language; label: string }[] = [
  { id: "java", label: "Java" },
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
];

const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
];

const STYLES: { id: InterviewStyle; label: string; blurb: string }[] = [
  { id: "general", label: "General SWE", blurb: "Balanced, covers approach through complexity." },
  { id: "fast-paced", label: "Fast-paced", blurb: "Time-conscious. Keeps you moving." },
  { id: "reasoning-focused", label: "Reasoning-focused", blurb: "Pushes hard on why, not just what." },
  { id: "collaborative", label: "Collaborative", blurb: "Conversational, closer to pairing." },
];

const DURATIONS = [15, 20, 30, 45];

function Choice({
  active,
  onClick,
  children,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-all ${
        active
          ? "border-accent/50 bg-accent/10 text-accent"
          : "border-line bg-surface text-muted hover:border-line/80 hover:bg-raised hover:text-body"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
        {label}
      </h3>
      {children}
    </div>
  );
}

export function ConfigForm({ problems }: { problems: ProblemSummary[] }) {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>("python");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [style, setStyle] = useState<InterviewStyle>("general");
  const [durationMin, setDurationMin] = useState(20);
  const [problemId, setProblemId] = useState("");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const filtered = useMemo(
    () => problems.filter((p) => p.difficulty === difficulty),
    [problems, difficulty],
  );

  // Keep a valid selection whenever the difficulty filter changes.
  useEffect(() => {
    if (!filtered.some((p) => p.id === problemId)) {
      setProblemId(filtered[0]?.id ?? "");
    }
  }, [filtered, problemId]);

  const toolchainMissing = health && !health.toolchains[language];

  async function start() {
    if (!problemId) return;
    setStarting(true);
    setError(null);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language, difficulty, style, problemId, durationMin }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not start the interview.");
      router.push(`/interview/${data.session.id}`);
    } catch (err) {
      setError((err as Error).message);
      setStarting(false);
    }
  }

  return (
    <div className="space-y-7">
      <div className="grid gap-7 sm:grid-cols-2">
        <Field label="Programming language">
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((item) => (
              <Choice
                key={item.id}
                active={language === item.id}
                onClick={() => setLanguage(item.id)}
              >
                {item.label}
                {health && !health.toolchains[item.id] ? (
                  <span className="ml-1.5 text-[10px] text-warn">unavailable</span>
                ) : null}
              </Choice>
            ))}
          </div>
        </Field>

        <Field label="Difficulty">
          <div className="flex flex-wrap gap-2">
            {DIFFICULTIES.map((item) => (
              <Choice
                key={item.id}
                active={difficulty === item.id}
                onClick={() => setDifficulty(item.id)}
              >
                {item.label}
              </Choice>
            ))}
          </div>
        </Field>
      </div>

      <Field label="Interview style">
        <div className="grid gap-2 sm:grid-cols-2">
          {STYLES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStyle(item.id)}
              className={`rounded-lg border px-3.5 py-2.5 text-left transition-all ${
                style === item.id
                  ? "border-accent/50 bg-accent/10"
                  : "border-line bg-surface hover:border-line/80 hover:bg-raised"
              }`}
            >
              <div
                className={`text-[13px] font-medium ${style === item.id ? "text-accent" : "text-body"}`}
              >
                {item.label}
              </div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-faint">{item.blurb}</div>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Length">
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((minutes) => (
            <Choice
              key={minutes}
              active={durationMin === minutes}
              onClick={() => setDurationMin(minutes)}
            >
              {minutes} min
            </Choice>
          ))}
        </div>
      </Field>

      <Field label={`Problem — ${filtered.length} available`}>
        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {filtered.map((problem) => (
            <button
              key={problem.id}
              type="button"
              onClick={() => setProblemId(problem.id)}
              className={`w-full rounded-lg border px-3.5 py-2.5 text-left transition-all ${
                problemId === problem.id
                  ? "border-accent/50 bg-accent/10"
                  : "border-line bg-surface hover:border-line/80 hover:bg-raised"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-[13px] font-medium ${
                    problemId === problem.id ? "text-accent" : "text-body"
                  }`}
                >
                  {problem.title}
                </span>
                <span className="rounded-full border border-line px-1.5 py-px text-[10px] text-faint">
                  {problem.category}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-faint">
                {problem.blurb}
              </p>
              <p className="mt-1 font-mono text-[10.5px] text-faint/70">
                {problem.visibleTests} visible + {problem.hiddenTests} hidden tests
              </p>
            </button>
          ))}
        </div>
      </Field>

      {toolchainMissing ? (
        <p className="rounded-lg border border-warn/25 bg-warn/5 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-warn">
          The {language} toolchain was not found on this machine, so Run Code will fail.
          Install it, or pick another language.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-bad/25 bg-bad/5 px-3.5 py-2.5 text-[12.5px] text-bad">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <button
          type="button"
          onClick={start}
          disabled={starting || !problemId}
          className="rounded-lg bg-accent px-6 py-2.5 text-[14px] font-semibold text-ink transition-all hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {starting ? "Starting…" : "Start interview"}
        </button>

        {health ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-faint">
            <span>
              Interviewer:{" "}
              <span className={health.interviewer.mode === "model" ? "text-accent" : "text-warn"}>
                {health.interviewer.mode === "model"
                  ? `${health.interviewer.provider} ${health.interviewer.model}`
                  : "offline mode"}
              </span>
            </span>
            <span>
              Voice: <span className="text-muted">{health.voice.tts}</span>
            </span>
          </div>
        ) : null}
      </div>

      {health?.interviewer.mode === "offline" ? (
        <p className="text-[11.5px] leading-relaxed text-faint">
          No model API key is configured, so the interviewer runs on its built-in rule
          engine — it still asks questions, escalates hints and scores you, but it is
          less adaptive. Add <code className="font-mono text-muted">GEMINI_API_KEY</code> to{" "}
          <code className="font-mono text-muted">.env.local</code> for the full experience.
        </p>
      ) : null}
    </div>
  );
}
