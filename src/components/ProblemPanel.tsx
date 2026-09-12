"use client";

import type { PublicProblem } from "@/lib/problems";
import { DIFFICULTY_STYLE } from "@/lib/format";
import { Prose } from "./Prose";

export function ProblemPanel({ problem }: { problem: PublicProblem }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-line px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-semibold text-body">{problem.title}</h2>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${DIFFICULTY_STYLE[problem.difficulty]}`}
          >
            {problem.difficulty}
          </span>
        </div>
        <p className="mt-1 text-xs text-faint">{problem.category}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3 text-[13.5px] leading-relaxed text-body/90">
          {problem.description.map((paragraph, i) => (
            <Prose key={i} text={paragraph} />
          ))}
        </div>

        <h3 className="mt-6 mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
          Examples
        </h3>
        <div className="space-y-2.5">
          {problem.examples.map((example, i) => (
            <div key={i} className="rounded-lg border border-line-soft bg-surface/60 p-3">
              <div className="font-mono text-[11.5px] leading-relaxed">
                <div className="text-muted">
                  <span className="text-faint">Input: </span>
                  {example.input}
                </div>
                <div className="mt-0.5 text-accent">
                  <span className="text-faint">Output: </span>
                  {example.output}
                </div>
              </div>
              {example.explanation ? (
                <p className="mt-2 text-[12px] leading-relaxed text-muted">
                  {example.explanation}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        <h3 className="mt-6 mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
          Constraints
        </h3>
        <ul className="space-y-1">
          {problem.constraints.map((constraint, i) => (
            <li key={i} className="flex gap-2 text-[12.5px] text-muted">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-faint" />
              <span className="font-mono text-[11.5px] leading-relaxed">{constraint}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-lg border border-line-soft bg-surface/40 p-3">
          <p className="text-[11.5px] leading-relaxed text-faint">
            You are also graded against{" "}
            <span className="text-muted">{problem.hiddenTestCount} hidden test cases</span>{" "}
            covering edge cases and input size. You will see them in your debrief.
          </p>
        </div>
      </div>
    </div>
  );
}
