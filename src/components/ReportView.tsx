"use client";

import Link from "next/link";
import { useState } from "react";
import type { ClientSession } from "@/lib/serialize";
import type { Report } from "@/lib/types";
import { DIFFICULTY_STYLE, formatClock, LANGUAGE_LABEL } from "@/lib/format";
import { Scorecard, CommunicationBars } from "./Scorecard";
import { Timeline } from "./Timeline";

const VERDICT_STYLE: Record<Report["verdict"], string> = {
  "strong hire": "text-accent border-accent/40 bg-accent/10",
  hire: "text-accent border-accent/30 bg-accent/5",
  "lean hire": "text-warn border-warn/30 bg-warn/5",
  borderline: "text-warn border-warn/40 bg-warn/10",
  "no hire": "text-bad border-bad/30 bg-bad/10",
};

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-panel p-5">
      <h2 className="text-[14px] font-semibold text-body">{title}</h2>
      {subtitle ? <p className="mt-0.5 mb-3 text-[12px] text-faint">{subtitle}</p> : <div className="mb-3" />}
      {children}
    </section>
  );
}

export function ReportView({ session }: { session: ClientSession }) {
  const [tab, setTab] = useState<"debrief" | "transcript" | "code">("debrief");
  const report = session.report;
  if (!report) return null;

  const run = session.runs.length ? session.runs[session.runs.length - 1] : null;
  const scoreColour =
    report.overall >= 75 ? "text-accent" : report.overall >= 55 ? "text-warn" : "text-bad";

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/"
            className="text-[11.5px] text-faint transition-colors hover:text-muted"
          >
            ← New interview
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-body">
            Interview debrief
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-faint">
            <span className="text-muted">{session.problem.title}</span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${DIFFICULTY_STYLE[session.problem.difficulty]}`}
            >
              {session.problem.difficulty}
            </span>
            <span>·</span>
            <span>{LANGUAGE_LABEL[session.config.language]}</span>
            <span>·</span>
            <span>{formatClock(session.elapsedMs)} elapsed</span>
            <span>·</span>
            <span className="capitalize">{session.config.style.replace("-", " ")}</span>
          </div>
        </div>

        <div className="text-right">
          <div className={`font-mono text-4xl font-semibold tabular-nums ${scoreColour}`}>
            {report.overall}
            <span className="text-lg text-faint">/100</span>
          </div>
          <span
            className={`mt-1.5 inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${VERDICT_STYLE[report.verdict]}`}
          >
            {report.verdict}
          </span>
        </div>
      </div>

      <p className="mb-6 rounded-xl border border-line bg-panel px-5 py-4 text-[14px] leading-relaxed text-body">
        {report.headline}
      </p>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b border-line">
        {(["debrief", "transcript", "code"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`-mb-px border-b-2 px-3.5 py-2 text-[12.5px] font-medium capitalize transition-colors ${
              tab === item
                ? "border-accent text-accent"
                : "border-transparent text-faint hover:text-muted"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "debrief" ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Section title="What you did well">
              <ul className="space-y-2">
                {report.didWell.map((item, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-muted">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="What hurt you">
              <ul className="space-y-2">
                {report.hurtYou.map((item, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-muted">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-bad" />
                    {item}
                  </li>
                ))}
              </ul>
            </Section>
          </div>

          {report.momentToImprove ? (
            <Section
              title="Interview moment to improve"
              subtitle="The single exchange most worth rehearsing before your next interview."
            >
              <p className="text-[13px] font-medium text-body">
                {report.momentToImprove.moment}
              </p>
              <div className="mt-3 space-y-3">
                <div className="rounded-lg border border-bad/20 bg-bad/5 px-3.5 py-2.5">
                  <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-bad/80">
                    What you said
                  </p>
                  <p className="text-[13px] leading-relaxed text-muted">
                    {report.momentToImprove.whatYouSaid}
                  </p>
                </div>
                <div className="rounded-lg border border-accent/20 bg-accent/5 px-3.5 py-2.5">
                  <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-accent/80">
                    A stronger answer
                  </p>
                  <p className="text-[13px] leading-relaxed text-body">
                    {report.momentToImprove.betterExplanation}
                  </p>
                </div>
              </div>
            </Section>
          ) : null}

          <Section title="Scorecard">
            <Scorecard lines={report.scorecard} />
          </Section>

          <Section
            title="Communication"
            subtitle="Technical communication only — never accent, vocabulary or speaking style."
          >
            <CommunicationBars signals={report.communication} />
          </Section>

          <Section title="Technical assessment">
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {[
                {
                  label: "Tests passed",
                  value: `${report.technical.testsPassed}/${report.technical.testsTotal}`,
                  tone:
                    report.technical.testsPassed === report.technical.testsTotal
                      ? "text-accent"
                      : "text-warn",
                },
                {
                  label: "Hidden edge cases",
                  value: `${report.technical.hiddenPassed}/${report.technical.hiddenTotal}`,
                  tone:
                    report.technical.hiddenPassed === report.technical.hiddenTotal
                      ? "text-accent"
                      : "text-warn",
                },
                {
                  label: "Complexity you stated",
                  value: report.technical.statedTime
                    ? `${report.technical.statedTime}${report.technical.statedSpace ? ` time, ${report.technical.statedSpace} space` : ""}`
                    : "never stated",
                  tone: report.technical.statedTime ? "text-body" : "text-bad",
                },
                {
                  label: "Optimal for this problem",
                  value: `${report.technical.optimalTime} time, ${report.technical.optimalSpace} space`,
                  tone: "text-muted",
                },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                    {item.label}
                  </dt>
                  <dd className={`mt-0.5 font-mono text-[13px] ${item.tone}`}>{item.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 space-y-2.5 border-t border-line-soft pt-4">
              {[
                { label: "Approach", value: report.technical.approachSummary },
                { label: "Edge cases", value: report.technical.edgeCases },
                { label: "Readability", value: report.technical.readability },
              ].map((item) => (
                <div key={item.label}>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                    {item.label}{" "}
                  </span>
                  <span className="text-[13px] leading-relaxed text-muted">{item.value}</span>
                </div>
              ))}
            </div>
          </Section>

          <div className="grid gap-4 sm:grid-cols-2">
            <Section title="Interviewer assistance">
              <p className="text-[13px] leading-relaxed text-muted">{report.hintsUsed.summary}</p>
              {session.hints.length ? (
                <ul className="mt-3 space-y-2 border-t border-line-soft pt-3">
                  {session.hints.map((hint, i) => (
                    <li key={i} className="text-[12px] leading-relaxed text-faint">
                      <span className="font-mono text-hint">
                        [{formatClock(hint.elapsed)}] L{hint.level}
                      </span>{" "}
                      {hint.text}
                    </li>
                  ))}
                </ul>
              ) : null}
            </Section>

            <Section title="Practise next">
              <ul className="space-y-2">
                {report.focusNext.map((item, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-muted">
                    <span className="mt-[2px] font-mono text-[11px] text-info">{i + 1}.</span>
                    {item}
                  </li>
                ))}
              </ul>
            </Section>
          </div>

          <Section
            title="Interview timeline"
            subtitle="Why your score is what it is, moment by moment."
          >
            <Timeline events={session.timeline} />
          </Section>

          {report.offline ? (
            <p className="text-[11.5px] leading-relaxed text-faint">
              This debrief was produced by the built-in scoring engine from measured
              signals, because no model API key is configured. Add one for a written
              narrative assessment.
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "transcript" ? (
        <div className="space-y-3">
          {session.transcript.length === 0 ? (
            <p className="rounded-xl border border-line bg-panel px-5 py-8 text-center text-[13px] text-faint">
              Nothing was said during this interview.
            </p>
          ) : (
            session.transcript.map((turn) => (
              <div key={turn.id} className="rounded-lg border border-line bg-panel px-4 py-3">
                <div className="mb-1 flex items-baseline gap-2">
                  <span
                    className={`text-[10.5px] font-semibold uppercase tracking-wider ${
                      turn.speaker === "interviewer"
                        ? "text-info"
                        : turn.speaker === "candidate"
                          ? "text-accent"
                          : "text-faint"
                    }`}
                  >
                    {turn.speaker === "candidate" ? "You" : turn.speaker}
                  </span>
                  <span className="font-mono text-[10px] text-faint">
                    {formatClock(turn.elapsed)}
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-muted">{turn.text}</p>
              </div>
            ))
          )}
        </div>
      ) : null}

      {tab === "code" ? (
        <div className="space-y-4">
          <Section title="Your final solution">
            <pre className="overflow-x-auto rounded-lg border border-line-soft bg-surface p-4 font-mono text-[12px] leading-relaxed text-body">
              {session.code}
            </pre>
          </Section>

          {run ? (
            <Section
              title="Final test run"
              subtitle="Hidden test inputs are revealed now that the interview is over."
            >
              <div className="space-y-1.5">
                {run.results.map((result) => (
                  <div
                    key={result.index}
                    className="rounded-lg border border-line-soft bg-surface px-3.5 py-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`font-mono text-[11px] ${result.passed ? "text-accent" : "text-bad"}`}
                      >
                        {result.passed ? "PASS" : "FAIL"}
                      </span>
                      <span className="flex-1 text-[12.5px] text-muted">{result.label}</span>
                      {result.hidden ? (
                        <span className="rounded border border-line px-1.5 py-px text-[9.5px] uppercase tracking-wide text-faint">
                          hidden
                        </span>
                      ) : null}
                    </div>
                    {!result.passed ? (
                      <div className="mt-1.5 space-y-0.5 font-mono text-[11px]">
                        <div className="text-faint">
                          input <span className="text-muted">{result.input}</span>
                        </div>
                        <div className="text-faint">
                          expected <span className="text-accent/80">{result.expected}</span>
                        </div>
                        <div className="text-faint">
                          actual <span className="text-bad">{result.actual}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Section>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3 border-t border-line pt-6">
        <Link
          href="/"
          className="rounded-lg bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-ink transition-all hover:bg-accent/90"
        >
          Run another interview
        </Link>
        <Link
          href="/sessions"
          className="rounded-lg border border-line bg-surface px-5 py-2.5 text-[13.5px] text-muted transition-colors hover:text-body"
        >
          All past interviews
        </Link>
      </div>
    </main>
  );
}
