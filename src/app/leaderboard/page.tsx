import Link from "next/link";
import { SiteHeader, UnavailableNotice } from "@/components/ui";
import { getAllProblems } from "@/lib/problems-store";
import { listPublicUserIds } from "@/lib/users";
import { listLeaderboardEntries, type LeaderboardEntry } from "@/lib/interview-sessions";
import { bandFor } from "@/lib/grading";
import { logServerError } from "@/lib/debug-log";
import { ProblemFilter } from "./problem-filter";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ problemId?: string }>;
}) {
  const { problemId: rawProblemId } = await searchParams;
  const problemId = rawProblemId || undefined;

  let problems, entries: LeaderboardEntry[];
  try {
    const [publicUsers, allProblems] = await Promise.all([listPublicUserIds(), getAllProblems()]);
    problems = allProblems;
    entries = await listLeaderboardEntries({ problemId, publicUsers, limit: 50 });
  } catch (err) {
    await logServerError("leaderboard", err);
    return (
      <>
        <SiteHeader active="leaderboard" />
        <UnavailableNotice
          title="Leaderboard unavailable"
          message="Could not load the leaderboard. Check the Firestore connection and refresh this page."
        />
      </>
    );
  }

  return (
    <>
      <SiteHeader active="leaderboard" />
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-14 sm:py-16">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Leaderboard</h1>
        <p className="text-sm text-muted mb-6">
          Ranked by best score among users who&apos;ve opted in to public sharing in Settings.
        </p>

        <div className="mb-6">
          <ProblemFilter problems={problems.map((p) => ({ id: p.id, title: p.title }))} selected={problemId} />
        </div>

        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-strong px-5 py-10 text-center">
            <p className="text-muted">No public scores yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {entries.map((entry, i) => (
              <Link
                key={entry.sessionId}
                href={`/public/sessions/${entry.sessionId}`}
                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card px-5 py-4 hover:border-accent transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="w-6 text-muted text-sm tabular-nums">{i + 1}</span>
                  <div>
                    <div className="font-medium">{entry.displayName ?? "Anonymous"}</div>
                    <div className="text-sm text-muted">{entry.problemTitle}</div>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-semibold text-accent">{entry.overallScore}/100</div>
                  <div className="text-xs text-muted">{bandFor(entry.overallScore).label}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
