import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession, saveSession } from "@/lib/store";
import { clientSession } from "@/lib/serialize";
import { generateReport } from "@/lib/agent/assessment";
import { ReportView } from "@/components/ReportView";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();

  // Reaching the debrief directly (a refresh, or a bookmark) still has to work,
  // so finish any interview that was left open and generate the report here.
  if (!session.endedAt) {
    session.endedAt = Date.now();
    session.phase = "ended";
    await saveSession(session);
  }
  if (!session.report) {
    session.report = await generateReport(session);
    await saveSession(session);
  }

  return (
    <>
      <ReportView session={clientSession(session)} />
      <div className="sr-only">
        <Link href="/">Home</Link>
      </div>
    </>
  );
}
