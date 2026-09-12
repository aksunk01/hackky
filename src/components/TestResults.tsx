"use client";

import { useState } from "react";
import type { RunResult } from "@/lib/types";

interface Props {
  run: RunResult | null;
  running: boolean;
}

export function TestResults({ run, running }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (running) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-6 text-[13px] text-muted">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-accent" />
        Running your code against the test suite…
      </div>
    );
  }

  if (!run) {
    return (
      <div className="px-4 py-6 text-[12.5px] leading-relaxed text-faint">
        Run your code to see results. Your interviewer sees them too — including the
        hidden cases.
      </div>
    );
  }

  if (run.compileError) {
    return (
      <div className="px-4 py-3.5">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-bad" />
          <span className="text-[12.5px] font-medium text-bad">
            {run.language === "java" ? "Compilation failed" : "Your code could not run"}
          </span>
        </div>
        <pre className="max-h-52 overflow-auto rounded-lg border border-bad/20 bg-bad/5 p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-bad/90">
          {run.compileError}
        </pre>
      </div>
    );
  }

  const allPassed = run.passed === run.total;

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-line-soft px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${allPassed ? "bg-accent" : "bg-warn"}`} />
          <span className="text-[12.5px] font-medium">
            <span className={allPassed ? "text-accent" : "text-warn"}>
              {run.passed}/{run.total}
            </span>{" "}
            <span className="text-muted">tests passing</span>
          </span>
          {run.trigger === "interviewer" ? (
            <span className="rounded-full border border-info/25 bg-info/10 px-2 py-0.5 text-[10px] text-info">
              run by interviewer
            </span>
          ) : null}
        </div>
        <span className="font-mono text-[10.5px] text-faint">{run.totalMs}ms</span>
      </div>

      <div className="max-h-56 overflow-y-auto">
        {run.results.map((result) => {
          const isOpen = expanded === result.index;
          return (
            <div key={result.index} className="border-b border-line-soft/60 last:border-0">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : result.index)}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-raised/40"
              >
                <span
                  className={`font-mono text-[11px] ${result.passed ? "text-accent" : "text-bad"}`}
                >
                  {result.passed ? "PASS" : "FAIL"}
                </span>
                <span className="flex-1 truncate text-[12px] text-muted">{result.label}</span>
                {result.hidden ? (
                  <span className="rounded border border-line px-1.5 py-px text-[9.5px] uppercase tracking-wide text-faint">
                    hidden
                  </span>
                ) : null}
                {result.timedOut ? (
                  <span className="rounded border border-warn/30 bg-warn/10 px-1.5 py-px text-[9.5px] uppercase tracking-wide text-warn">
                    timeout
                  </span>
                ) : null}
                <span className="font-mono text-[10px] text-faint">{result.ms}ms</span>
              </button>

              {isOpen ? (
                <div className="space-y-1.5 bg-surface/60 px-4 pb-3 pt-1 font-mono text-[11px] leading-relaxed">
                  <div>
                    <span className="text-faint">input    </span>
                    <span className="text-muted">{result.input}</span>
                  </div>
                  <div>
                    <span className="text-faint">expected </span>
                    <span className="text-accent/80">{result.expected}</span>
                  </div>
                  <div>
                    <span className="text-faint">actual   </span>
                    <span className={result.passed ? "text-accent/80" : "text-bad"}>
                      {result.actual}
                    </span>
                  </div>
                  {result.stdout ? (
                    <div>
                      <span className="text-faint">stdout   </span>
                      <span className="whitespace-pre-wrap text-sky-300/80">
                        {result.stdout.trim()}
                      </span>
                    </div>
                  ) : null}
                  {result.error ? (
                    <pre className="mt-1.5 max-h-36 overflow-auto rounded border border-bad/20 bg-bad/5 p-2 whitespace-pre-wrap text-bad/90">
                      {result.error}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
