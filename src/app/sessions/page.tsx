import Link from "next/link";
import { listSessions } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function SessionsPage() {
  const sessions = await listSessions();

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <Link href="/" className="text-[11.5px] text-faint transition-colors hover:text-muted">
        ← New interview
      </Link>
      <h1 className="mt-2 mb-1 text-2xl font-semibold tracking-tight text-body">
        Past interviews
      </h1>
      <p className="mb-8 text-[13px] text-faint">
        Every interview you have run on this machine, newest first.
      </p>

      {sessions.length === 0 ? (
        <p className="rounded-xl border border-line bg-panel px-5 py-10 text-center text-[13px] text-faint">
          No interviews yet.{" "}
          <Link href="/" className="text-accent hover:underline">
            Run your first one.
          </Link>
        </p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li key={session.id}>
              <Link
                href={`/report/${session.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border border-line bg-panel px-4 py-3 transition-colors hover:border-line/70 hover:bg-raised"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium text-body">
                    {session.problemTitle}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-faint">
                    {session.endedAt
                      ? new Date(session.endedAt).toLocaleString()
                      : "not finished"}
                  </p>
                </div>
                {session.overall !== null ? (
                  <span
                    className={`shrink-0 font-mono text-[15px] tabular-nums ${
                      session.overall >= 75
                        ? "text-accent"
                        : session.overall >= 55
                          ? "text-warn"
                          : "text-bad"
                    }`}
                  >
                    {session.overall}
                    <span className="text-[11px] text-faint">/100</span>
                  </span>
                ) : (
                  <span className="shrink-0 text-[11.5px] text-faint">no score</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
