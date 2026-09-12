import Link from "next/link";
import { SiteHeader } from "@/components/ui";
import { getOwnerId } from "@/lib/owner-cookie";
import { listSessions } from "@/lib/interview-sessions";

export default async function SessionsPage() {
  const ownerId = await getOwnerId();
  let sessions;
  try {
    sessions = ownerId ? await listSessions(ownerId) : [];
  } catch {
    return (
      <>
        <SiteHeader />
        <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-16">
          <h1 className="text-2xl font-bold mb-4">Interview History</h1>
          <p className="text-danger">History is unavailable. Check the MySQL connection and refresh this page.</p>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader />
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-14 sm:py-16">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Interview History</h1>
          <p className="text-sm text-muted">Completed interviews from this browser.</p>
        </div>
        <Link href="/problems" className="text-sm text-accent hover:underline">Start another</Link>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="mb-4 text-muted">No completed interviews yet.</p>
          <Link href="/problems" className="text-accent hover:underline">Choose a problem</Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/sessions/${session.id}`}
              className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 hover:border-accent transition-colors"
            >
              <div>
                <div className="font-medium">{session.problemTitle}</div>
                <div className="text-sm text-muted">
                  {new Date(session.completedAt).toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" })}
                  {" · "}{session.testsPassed}/{session.testsTotal} tests passed
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-semibold text-accent">{session.overallScore}/100</div>
                <div className="text-xs text-muted">View report →</div>
              </div>
            </Link>
          ))}
        </div>
      )}
      </main>
    </>
  );
}
