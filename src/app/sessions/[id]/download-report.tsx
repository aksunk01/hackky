"use client";

import { Button } from "@/components/ui";
import { bandFor, dimensions } from "@/lib/grading";
import type { InterviewSession } from "@/lib/interview-session-types";

export default function DownloadReport({ session }: { session: InterviewSession }) {
  function download() {
    const lines = [
      `Interview Report — ${session.problemTitle}`,
      `Completed: ${session.completedAt}`,
      `Overall Score: ${session.overallScore}/100 — ${bandFor(session.overallScore).label}`,
      `Tests: ${session.testsPassed}/${session.testsTotal} passed`,
      "",
      "Scores (weight in overall):",
      ...dimensions.flatMap(({ key, label, weight }) => {
        const { score, rationale } = session.evaluation.scores[key];
        return [
          `- ${label} (${weight}%): ${score === null ? "not assessed" : `${score}/10`}`,
          ...(rationale ? [`    ${rationale}`] : []),
        ];
      }),
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
    <Button onClick={download}>
      Download Report
    </Button>
  );
}
