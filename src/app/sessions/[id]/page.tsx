import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/ui";
import { getOwnerId } from "@/lib/owner-cookie";
import { getSession } from "@/lib/interview-sessions";
import { metrics } from "@/lib/interview-session-types";
import DownloadReport from "./download-report";

export default async function SavedReportPage({ params }: PageProps<"/sessions/[id]">) {
  const { id } = await params;
  const ownerId = await getOwnerId();
  if (!ownerId || !/^[0-9a-f-]{36}$/i.test(id)) notFound();

  let session;
  try {
    session = await getSession(id, ownerId);
  } catch {
    return (
      <>
        <SiteHeader />
        <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-16">
          <h1 className="text-2xl font-bold mb-4">Report unavailable</h1>
          <p className="text-danger">Could not load this report. Check the MySQL connection and refresh this page.</p>
        </main>
      </>
    );
  }
  if (!session) notFound();

  const started = new Date(session.startedAt);
  const completed = new Date(session.completedAt);
  const durationMinutes = Math.max(0, Math.round((completed.getTime() - started.getTime()) / 60_000));
  const formatTime = (date: Date) => date.toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" });
  const scoreTone = session.overallScore >= 80
    ? "border-success"
    : session.overallScore >= 50
      ? "border-warning"
      : "border-danger";

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
          <div className={`h-20 w-20 rounded-full border-[6px] bg-card flex flex-col items-center justify-center ${scoreTone}`}>
            <strong className="text-xl leading-none">{session.overallScore}</strong>
            <span className="text-[10px] text-muted">/ 100</span>
          </div>
          <DownloadReport session={session} />
        </div>
      </div>

      {session.mocked && (
        <p className="rounded-lg border border-warning bg-warning-soft px-4 py-3 text-sm text-warning">
          Demo-mode grading: Gemini was unavailable, so scores and feedback use a test-based fallback.
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
        <div className="space-y-3">
          {metrics.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3 text-sm">
              <span className="w-40 shrink-0">{label}</span>
              <div className="flex-1 h-2 rounded-full bg-subtle overflow-hidden">
                <div className="h-full bg-accent" style={{ width: `${session.evaluation[key] * 10}%` }} />
              </div>
              <span className="w-12 text-right">{session.evaluation[key]}/10</span>
            </div>
          ))}
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
