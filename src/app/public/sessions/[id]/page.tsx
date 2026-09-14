import { notFound } from "next/navigation";
import { SiteHeader, UnavailableNotice } from "@/components/ui";
import { getPublicSession } from "@/lib/interview-sessions";
import { bandFor } from "@/lib/grading";
import { logServerError } from "@/lib/debug-log";

export default async function PublicSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  let session;
  try {
    session = await getPublicSession(id);
  } catch (err) {
    await logServerError("public-session", err);
    return (
      <>
        <SiteHeader active="leaderboard" />
        <UnavailableNotice
          title="Report unavailable"
          message="Could not load this report. Check the Firestore connection and refresh this page."
        />
      </>
    );
  }
  // Covers both "no such session" and "owner is no longer sharing publicly" identically —
  // the two cases must be indistinguishable to a visitor.
  if (!session) notFound();

  const band = bandFor(session.overallScore);
  const tone = {
    success: { ring: "border-success", text: "text-success" },
    warning: { ring: "border-warning", text: "text-warning" },
    danger: { ring: "border-danger", text: "text-danger" },
  }[band.tone];
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" });

  return (
    <>
      <SiteHeader active="leaderboard" />
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{session.problemTitle}</h1>
            <p className="text-sm text-muted mt-1">Completed {formatTime(session.completedAt)}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`h-20 w-20 rounded-full border-[6px] bg-card flex flex-col items-center justify-center ${tone.ring}`}>
              <strong className="text-xl leading-none">{session.overallScore}</strong>
              <span className="text-[10px] text-muted">/ 100</span>
            </div>
            <div>
              <div className={`font-semibold ${tone.text}`}>{band.label}</div>
              <div className="text-xs text-muted">
                Tests passed: {session.testsPassed}/{session.testsTotal}
              </div>
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-semibold mb-3">Final Code</h2>
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-subtle p-4 text-sm font-mono">
            {session.finalCode}
          </pre>
        </section>
      </main>
    </>
  );
}
