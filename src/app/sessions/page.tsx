import Link from "next/link";
import { getOwnerId } from "@/lib/owner-cookie";
import { listSessions } from "@/lib/interview-sessions";

export default async function SessionsPage() {
  const ownerId = await getOwnerId();
  let sessions;
  try {
    sessions = ownerId ? await listSessions(ownerId) : [];
  } catch {
    return (
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold mb-4">Interview History</h1>
        <p className="text-red-600 dark:text-red-400">History is unavailable. Check the MySQL connection and refresh this page.</p>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-16">
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold">Interview History</h1>
          <p className="text-sm text-black/60 dark:text-white/60">Completed interviews from this browser.</p>
        </div>
        <Link href="/problems" className="text-sm text-blue-600 hover:underline">Start another</Link>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-black/10 dark:border-white/10 p-8 text-center">
          <p className="mb-4 text-black/60 dark:text-white/60">No completed interviews yet.</p>
          <Link href="/problems" className="text-blue-600 hover:underline">Choose a problem</Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/sessions/${session.id}`}
              className="flex items-center justify-between gap-4 rounded-xl border border-black/10 dark:border-white/10 px-5 py-4 hover:border-blue-500 transition-colors"
            >
              <div>
                <div className="font-medium">{session.problemTitle}</div>
                <div className="text-sm text-black/50 dark:text-white/50">
                  {new Date(session.completedAt).toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" })}
                  {" · "}{session.testsPassed}/{session.testsTotal} tests passed
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-semibold text-blue-600">{session.overallScore}/100</div>
                <div className="text-xs text-black/40 dark:text-white/40">View report →</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
