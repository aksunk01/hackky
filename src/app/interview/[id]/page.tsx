import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/store";
import { clientSession } from "@/lib/serialize";
import { InterviewRoom } from "@/components/InterviewRoom";

export const dynamic = "force-dynamic";

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession(id);
  if (!session) notFound();
  if (session.endedAt) redirect(`/report/${id}`);

  return <InterviewRoom initial={clientSession(session)} />;
}
