"use client";

import { useSyncExternalStore } from "react";
import { LinkButton, Button, SiteHeader } from "@/components/ui";
import type { Evaluation } from "@/app/api/evaluate/route";

type StoredResult = {
  problem: string;
  evaluation: Evaluation;
  mocked: boolean;
};

const METRICS: { key: keyof Evaluation; label: string }[] = [
  { key: "problemSolving", label: "Problem Solving" },
  { key: "communication", label: "Communication" },
  { key: "correctness", label: "Correctness" },
  { key: "codeQuality", label: "Code Quality" },
  { key: "complexityAnalysis", label: "Complexity Analysis" },
  { key: "debugging", label: "Debugging" },
];

function subscribe() {
  return () => {};
}

function getSnapshot() {
  return sessionStorage.getItem("interview-result");
}

function getServerSnapshot() {
  return null;
}

export default function ResultsPage() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const result: StoredResult | null = raw ? JSON.parse(raw) : null;

  if (!result) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4">
        <p className="text-muted">No completed interview found.</p>
        <LinkButton href="/problems" size="sm">
          Start a new interview
        </LinkButton>
      </main>
    );
  }

  const { evaluation } = result;
  const scoreTone =
    evaluation.overall >= 80
      ? "text-success border-success"
      : evaluation.overall >= 50
        ? "text-warning border-warning"
        : "text-danger border-danger";

  function downloadReport() {
    const lines = [
      `Interview Report — ${result!.problem}`,
      `Overall Score: ${evaluation.overall}/100`,
      "",
      ...METRICS.map((m) => `${m.label}: ${evaluation[m.key]}/10`),
      "",
      "Feedback:",
      evaluation.feedback,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "interview-report.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="flex-1 flex flex-col">
      <SiteHeader />
      <div className="flex-1 flex flex-col items-center px-6 py-14 sm:py-16">
        <div className="w-full max-w-md animate-fade-up">
          <h1 className="text-2xl sm:text-3xl font-bold text-center tracking-tight mb-1">
            Interview Complete
          </h1>
          <p className="text-center text-muted mb-8">{result.problem}</p>

          <div className="flex justify-center mb-2">
            <div
              className={`relative w-32 h-32 rounded-full border-8 flex items-center justify-center bg-card ${scoreTone}`}
            >
              <span className="text-3xl font-bold text-foreground">{evaluation.overall}</span>
            </div>
          </div>
          <p className="text-center text-xs text-muted mb-8 uppercase tracking-wide">Overall Score</p>

          <div className="flex flex-col gap-3 mb-8 rounded-2xl border border-border bg-card p-5">
            {METRICS.map((m) => (
              <div key={m.key} className="flex items-center gap-3">
                <span className="w-36 sm:w-40 text-sm shrink-0">{m.label}</span>
                <div className="flex-1 h-2 rounded-full bg-subtle overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${(Number(evaluation[m.key]) / 10) * 100}%` }}
                  />
                </div>
                <span className="w-10 text-right text-sm text-muted">{evaluation[m.key]}/10</span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-card border border-border p-4 text-sm leading-relaxed mb-8">
            {evaluation.feedback}
          </div>

          {result.mocked && (
            <p className="text-xs text-warning text-center mb-4">
              Demo mode: set GEMINI_API_KEY for AI-generated interviewing &amp; scoring.
            </p>
          )}

          <div className="flex gap-3">
            <Button onClick={downloadReport} className="flex-1">
              Download Report
            </Button>
            <LinkButton href="/problems" variant="secondary" className="flex-1">
              Try Another
            </LinkButton>
          </div>
        </div>
      </div>
    </main>
  );
}
