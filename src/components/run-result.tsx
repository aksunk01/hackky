"use client";

import { useState } from "react";
import type { ExecutionResult } from "@/lib/execute";
import { paramNames, type Problem } from "@/lib/problems";

/** The LeetCode-style headline for a run. */
function verdict(result: ExecutionResult): { label: string; ok: boolean } {
  if (result.crashed) {
    if (result.crashOutput?.startsWith("Timed out")) return { label: "Time Limit Exceeded", ok: false };
    return { label: result.crashStage === "run" ? "Runtime Error" : "Compile Error", ok: false };
  }
  if (result.results.some((r) => r.error)) return { label: "Runtime Error", ok: false };
  if (result.passed === result.total) return { label: "Accepted", ok: true };
  return { label: "Wrong Answer", ok: false };
}

function firstFailingCase(result: ExecutionResult): number {
  const index = result.results.findIndex((r) => !r.passed);
  return index === -1 ? 0 : index;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-[11px] font-sans font-medium text-muted">{title}</div>
      {children}
    </div>
  );
}

function Value({ children, tone }: { children: React.ReactNode; tone?: "success" | "danger" }) {
  const color = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-foreground";
  return (
    <pre className={`rounded-md bg-card border border-border px-2.5 py-1.5 whitespace-pre-wrap break-all ${color}`}>
      {children}
    </pre>
  );
}

export function RunResultPanel({ result, problem }: { result: ExecutionResult; problem: Problem }) {
  const [selected, setSelected] = useState(() => firstFailingCase(result));
  // Each new run opens on its first failing case, like LeetCode does.
  const [shownResult, setShownResult] = useState(result);
  if (shownResult !== result) {
    setShownResult(result);
    setSelected(firstFailingCase(result));
  }

  const { label, ok } = verdict(result);
  const names = paramNames(problem);
  const current = result.results[selected] ?? result.results[0];

  return (
    <div className="border-t border-border bg-subtle text-xs font-mono max-h-72 overflow-y-auto">
      <div className="flex items-baseline gap-3 px-3 pt-3 pb-2 font-sans">
        <span className={`text-base font-semibold ${ok ? "text-success" : "text-danger"}`}>{label}</span>
        {result.runtimeMs !== undefined && <span className="text-muted">Runtime: {result.runtimeMs} ms</span>}
        {!result.crashed && (
          <span className="text-muted">
            {result.passed}/{result.total} passed
          </span>
        )}
      </div>

      {result.crashed ? (
        <div className="px-3 pb-3">
          <Value tone="danger">{result.crashOutput}</Value>
          {result.stdout && (
            <div className="mt-3">
              <Section title="Stdout">
                <Value>{result.stdout}</Value>
              </Section>
            </div>
          )}
        </div>
      ) : (
        current && (
          <div className="px-3 pb-3">
            <div className="flex flex-wrap gap-1.5 mb-3">
              {result.results.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected(i)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-sans transition-colors ${
                    i === selected ? "bg-card border border-border-strong text-foreground" : "text-muted hover:bg-card"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${r.passed ? "bg-success" : "bg-danger"}`} />
                  Case {i + 1}
                </button>
              ))}
            </div>

            <Section title="Input">
              <div className="space-y-1.5">
                {current.args.map((arg, i) => (
                  <div key={i}>
                    <div className="text-muted mb-0.5">{names[i]} =</div>
                    <Value>{JSON.stringify(arg)}</Value>
                  </div>
                ))}
              </div>
            </Section>

            {current.stdout && (
              <Section title="Stdout">
                <Value>{current.stdout}</Value>
              </Section>
            )}

            <Section title="Output">
              <Value tone={current.passed ? "success" : "danger"}>
                {current.error ? current.error : JSON.stringify(current.actual)}
              </Value>
            </Section>

            <Section title="Expected">
              <Value>{JSON.stringify(current.expected)}</Value>
            </Section>
          </div>
        )
      )}
    </div>
  );
}
