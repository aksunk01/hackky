"use client";

import { useRouter } from "next/navigation";
import { textInputClass } from "@/components/ui";

export function ProblemFilter({
  problems,
  selected,
}: {
  problems: { id: string; title: string }[];
  selected?: string;
}) {
  const router = useRouter();
  return (
    <select
      value={selected ?? ""}
      onChange={(e) => router.push(e.target.value ? `/leaderboard?problemId=${e.target.value}` : "/leaderboard")}
      className={`${textInputClass} sm:w-64`}
      aria-label="Filter by problem"
    >
      <option value="">All problems</option>
      {problems.map((p) => (
        <option key={p.id} value={p.id}>
          {p.title}
        </option>
      ))}
    </select>
  );
}
