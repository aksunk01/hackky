import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getSession } from "@/lib/interview-sessions";
import { bandFor, bands, dimensions } from "@/lib/grading";
import DownloadReport from "./download-report";

export default async function SavedReportPage({ params }: PageProps<"/sessions/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  let session;
  try {
    session = await getSession(id, user.uid);
  } catch {
    return (
      <>
        <SiteHeader />
        <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-16">
          <h1 className="text-2xl font-bold mb-4">Report unavailable</h1>
          <p className="text-danger">Could not load this report. Check the Firestore connection and refresh this page.</p>
        </main>
      </>
    );
  }
  if (!session) notFound();

  const started = new Date(session.startedAt);
  const completed = new Date(session.completedAt);
  const durationMinutes = Math.max(0, Math.round((completed.getTime() - started.getTime()) / 60_000));
  const formatTime = (date: Date) => date.toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" });
  const band = bandFor(session.overallScore);
  const tone = {
    success: { ring: "border-success", text: "text-success" },
    warning: { ring: "border-warning", text: "text-warning" },
    danger: { ring: "border-danger", text: "text-danger" },
  }[band.tone];
  const { scores } = session.evaluation;
  const assessedCount = dimensions.filter((dimension) => scores[dimension.key].score !== null).length;

  return (
    <>
      <SiteHeader />
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/sessions" className="text-sm text-accent hover:underline">← Interview History</Link>
          <h1 className="text-3xl font-bold mt-3">{session.problemTitle}</h1>
          <p className="text-sm text-muted mt-1">
            Started {formatTime(started)} · Completed {formatTime(completed)} · About {durationMinutes} min
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className={`h-20 w-20 rounded-full border-[6px] bg-card flex flex-col items-center justify-center ${tone.ring}`}>
              <strong className="text-xl leading-none">{session.overallScore}</strong>
              <span className="text-[10px] text-muted">/ 100</span>
            </div>
            <div>
              <div className={`font-semibold ${tone.text}`}>{band.label}</div>
              <div className="text-xs text-muted">Weighted across {assessedCount} of {dimensions.length} areas</div>
            </div>
          </div>
          <DownloadReport session={session} />
        </div>
      </div>

      {session.mocked && (
        <p className="rounded-lg border border-warning bg-warning-soft px-4 py-3 text-sm text-warning">
          Demo-mode grading: the AI grader was unavailable, so only correctness (from the test run) is scored. The other areas are marked not assessed.
        </p>
      )}

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">Evaluation</h2>
          <span className="text-2xl font-bold text-accent">{session.overallScore}/100</span>
        </div>
        <p className="text-sm mb-5">{session.evaluation.feedback}</p>
        <p className="text-sm text-muted mb-5">
          Tests passed: <strong>{session.testsPassed}/{session.testsTotal}</strong>
        </p>
        <div className="space-y-4">
          {dimensions.map(({ key, label, weight }) => {
            const { score, rationale } = scores[key];
            return (
              <div key={key} className="text-sm">
                <div className="flex items-center gap-3">
                  <span className="w-40 shrink-0">
                    {label}
                    <span className="ml-1.5 text-xs text-muted tabular-nums">{weight}%</span>
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-subtle overflow-hidden">
                    <div className={`h-full ${score === null ? "bg-border" : "bg-accent"}`} style={{ width: `${(score ?? 0) * 10}%` }} />
                  </div>
                  <span className={`w-24 text-right ${score === null ? "text-muted" : ""}`}>
                    {score === null ? "Not assessed" : `${score}/10`}
                  </span>
                </div>
                {rationale && <p className="mt-1 ml-40 pl-3 text-xs text-muted">{rationale}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-3">Strengths</h2>
          {session.evaluation.strengths.length ? (
            <ul className="list-disc pl-5 space-y-2 text-sm">{session.evaluation.strengths.map((point, i) => <li key={i}>{point}</li>)}</ul>
          ) : <p className="text-sm text-muted">No specific strengths identified in demo grading.</p>}
        </section>
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-3">Improvement Areas</h2>
          {session.evaluation.weaknesses.length ? (
            <ul className="list-disc pl-5 space-y-2 text-sm">{session.evaluation.weaknesses.map((point, i) => <li key={i}>{point}</li>)}</ul>
          ) : <p className="text-sm text-muted">No specific improvement areas identified.</p>}
        </section>
      </div>

      <details className="rounded-2xl border border-border bg-card p-5">
        <summary className="font-semibold cursor-pointer">How scoring works</summary>
        <p className="text-sm text-muted mt-3">
          Each area is scored 0–10 against the rubric below. The overall score is the weighted average of the areas that
          could be assessed, scaled to 100 — an area marked &ldquo;not assessed&rdquo; drops out and its weight is shared
          among the rest. Correctness is set directly from the test run; the other areas are graded from the transcript
          and code with a one-line reason for each score.
        </p>
        <div className="mt-4 space-y-4">
          {dimensions.map(({ key, label, weight, summary, anchors, notAssessedWhen }) => (
            <div key={key} className="text-sm">
              <div className="font-medium">
                {label} <span className="text-xs text-muted tabular-nums">{weight}%</span>
              </div>
              <p className="text-muted text-xs mt-0.5">{summary}</p>
              <dl className="mt-1.5 grid grid-cols-[2rem_1fr] gap-x-2 gap-y-0.5 text-xs">
                <dt className="text-muted tabular-nums">10</dt><dd>{anchors[10]}</dd>
                <dt className="text-muted tabular-nums">5</dt><dd>{anchors[5]}</dd>
                <dt className="text-muted tabular-nums">0</dt><dd>{anchors[0]}</dd>
                {notAssessedWhen && (<><dt className="text-muted">n/a</dt><dd>Not assessed when {notAssessedWhen}</dd></>)}
              </dl>
            </div>
          ))}
        </div>
        <div className="mt-5 text-sm">
          <div className="font-medium mb-1.5">Overall bands</div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {bands.map((item, i) => (
              <li key={item.label}>
                <span className="font-medium">{item.label}</span>{" "}
                <span className="text-muted tabular-nums">{item.min}–{i === 0 ? 100 : bands[i - 1].min - 1}</span>
              </li>
            ))}
          </ul>
        </div>
      </details>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold mb-3">Final Code</h2>
        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-subtle p-4 text-sm font-mono">{session.finalCode}</pre>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-semibold mb-3">Interview Transcript</h2>
        {session.transcript.length ? (
          <div className="space-y-3">
            {session.transcript.map((turn, i) => (
              <div key={i} className="text-sm">
                <strong>{turn.role === "user" ? "You" : "Alex"}</strong>
                <p className="whitespace-pre-wrap mt-1">{turn.text}</p>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-muted">No conversation recorded.</p>}
      </section>
      </main>
    </>
  );
}
