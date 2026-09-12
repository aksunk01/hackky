"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
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
        <p className="text-black/60 dark:text-white/60">No completed interview found.</p>
        <Link href="/problems" className="text-blue-600 hover:underline">
          Start a new interview
        </Link>
      </main>
    );
  }

  const { evaluation } = result;

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
    <main className="flex-1 flex flex-col items-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-1">Interview Complete!</h1>
        <p className="text-center text-black/50 dark:text-white/50 mb-8">{result.problem}</p>

        <div className="flex justify-center mb-8">
          <div className="relative w-32 h-32 rounded-full border-8 border-blue-500 flex items-center justify-center">
            <span className="text-3xl font-bold">{evaluation.overall}</span>
          </div>
        </div>
        <p className="text-center text-xs text-black/40 dark:text-white/40 -mt-6 mb-8">Overall Score</p>

        <div className="flex flex-col gap-3 mb-8">
          {METRICS.map((m) => (
            <div key={m.key} className="flex items-center gap-3">
              <span className="w-40 text-sm">{m.label}</span>
              <div className="flex-1 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${(Number(evaluation[m.key]) / 10) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right text-sm text-black/60 dark:text-white/60">
                {evaluation[m.key]}/10
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-xl bg-black/5 dark:bg-white/5 p-4 text-sm mb-8">{evaluation.feedback}</div>

        {result.mocked && (
          <p className="text-xs text-amber-600 dark:text-amber-400 text-center mb-4">
            Demo mode: set GEMINI_API_KEY for AI-generated interviewing &amp; scoring.
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={downloadReport}
            className="flex-1 rounded-full bg-blue-600 text-white py-2.5 font-medium hover:bg-blue-700"
          >
            Download Report
          </button>
          <Link
            href="/problems"
            className="flex-1 text-center rounded-full border border-black/10 dark:border-white/10 py-2.5 font-medium hover:bg-black/5 dark:hover:bg-white/10"
          >
            Try Another
          </Link>
        </div>
      </div>
    </main>
  );
}
