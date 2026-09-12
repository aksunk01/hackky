"use client";

import { metrics, type InterviewSession } from "@/lib/interview-session-types";

export default function DownloadReport({ session }: { session: InterviewSession }) {
  function download() {
    const lines = [
      `Interview Report — ${session.problemTitle}`,
      `Completed: ${session.completedAt}`,
      `Overall Score: ${session.overallScore}/100`,
      `Tests: ${session.testsPassed}/${session.testsTotal} passed`,
      "",
      ...metrics.map(({ key, label }) => `${label}: ${session.evaluation[key]}/10`),
      "",
      "Feedback:",
      session.evaluation.feedback,
      "",
      "Strengths:",
      ...session.evaluation.strengths.map((point) => `- ${point}`),
      "",
      "Improvement areas:",
      ...session.evaluation.weaknesses.map((point) => `- ${point}`),
      "",
      "Final code:",
      session.finalCode,
      "",
      "Transcript:",
      ...session.transcript.map((turn) => `${turn.role === "user" ? "Candidate" : "Alex"}: ${turn.text}`),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `interview-report-${session.id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button onClick={download} className="rounded-full bg-blue-600 text-white px-5 py-2.5 font-medium hover:bg-blue-700">
      Download Report
    </button>
  );
}
