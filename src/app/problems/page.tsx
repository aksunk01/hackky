import Link from "next/link";
import { problems } from "@/lib/problems";

const difficultyColor: Record<string, string> = {
  Easy: "text-green-600 dark:text-green-400",
  Medium: "text-amber-600 dark:text-amber-400",
  Hard: "text-red-600 dark:text-red-400",
};

export default function ProblemsPage() {
  return (
    <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-16">
      <h1 className="text-2xl font-bold mb-1">Choose a Problem</h1>
      <p className="text-black/60 dark:text-white/60 mb-8">
        Select a problem to begin your interview.
      </p>

      <div className="flex flex-col gap-3">
        {problems.map((p) => (
          <Link
            key={p.id}
            href={`/interview/${p.id}`}
            className="flex items-center justify-between rounded-xl border border-black/10 dark:border-white/10 px-5 py-4 hover:border-blue-500 transition-colors"
          >
            <div>
              <div className="font-medium">{p.title}</div>
              <div className="text-sm">
                <span className={difficultyColor[p.difficulty]}>{p.difficulty}</span>
                <span className="text-black/40 dark:text-white/40"> · {p.tags}</span>
              </div>
            </div>
            <span className="text-black/30 dark:text-white/30">&rarr;</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
