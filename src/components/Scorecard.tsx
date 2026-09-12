"use client";

import type { CommunicationSignals, ScoreLine } from "@/lib/types";

function scoreColour(score: number): string {
  if (score >= 8) return "text-accent";
  if (score >= 6) return "text-warn";
  return "text-bad";
}

function barColour(score: number): string {
  if (score >= 8) return "bg-accent";
  if (score >= 6) return "bg-warn";
  return "bg-bad";
}

export function Scorecard({ lines }: { lines: ScoreLine[] }) {
  return (
    <div className="divide-y divide-line-soft">
      {lines.map((line) => (
        <div key={line.category} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 py-3">
          <span className="text-[13.5px] font-medium text-body">{line.category}</span>
          <span className={`font-mono text-[13.5px] tabular-nums ${scoreColour(line.score)}`}>
            {line.score}/10
          </span>
          <p className="col-span-2 text-[12.5px] leading-relaxed text-muted">{line.feedback}</p>
        </div>
      ))}
    </div>
  );
}

const COMMUNICATION_LABELS: { key: keyof CommunicationSignals; label: string }[] = [
  { key: "thinkingAloud", label: "Thinking aloud" },
  { key: "explanationClarity", label: "Explanation clarity" },
  { key: "questionHandling", label: "Question handling" },
  { key: "conciseness", label: "Conciseness" },
  { key: "technicalReasoning", label: "Technical reasoning" },
];

export function CommunicationBars({ signals }: { signals: CommunicationSignals }) {
  return (
    <div className="space-y-2.5">
      {COMMUNICATION_LABELS.map(({ key, label }) => {
        const score = signals[key];
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="w-[150px] shrink-0 text-[12.5px] text-muted">{label}</span>
            <div className="flex flex-1 gap-[3px]">
              {Array.from({ length: 10 }, (_, i) => (
                <span
                  key={i}
                  className={`h-2.5 flex-1 rounded-[2px] ${
                    i < score ? barColour(score) : "bg-raised"
                  }`}
                />
              ))}
            </div>
            <span className={`w-10 shrink-0 text-right font-mono text-[12px] tabular-nums ${scoreColour(score)}`}>
              {score}/10
            </span>
          </div>
        );
      })}
    </div>
  );
}
