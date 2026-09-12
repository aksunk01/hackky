import Link from "next/link";
import { problemSummaries } from "@/lib/problems";
import { ConfigForm } from "@/components/ConfigForm";

export default function HomePage() {
  const problems = problemSummaries();

  return (
    <main className="mx-auto max-w-5xl px-5 py-12 sm:py-16">
      <header className="mb-12">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
            Voice-first mock interview
          </span>
        </div>

        <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-body sm:text-[2.6rem]">
          LeetCode teaches you to solve coding problems.
          <br />
          <span className="text-accent">This teaches you to pass the interview.</span>
        </h1>

        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted">
          An AI interviewer that hears you, watches your editor as you type, runs your
          code against hidden tests, challenges your reasoning in real time, and then
          tells you exactly where your interview broke down.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "It talks back",
              body: "Speak your approach out loud. It asks why you chose that data structure — before you finish typing it.",
            },
            {
              title: "It sees your code",
              body: "Nested loop on a problem that wants linear time? Expect to be asked about your runtime.",
            },
            {
              title: "It grades the interview",
              body: "Not just whether tests pass. Communication, debugging, complexity, and how much help you needed.",
            },
          ].map((card) => (
            <div key={card.title} className="rounded-xl border border-line bg-panel p-4">
              <h2 className="text-[13px] font-semibold text-body">{card.title}</h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-faint">{card.body}</p>
            </div>
          ))}
        </div>
      </header>

      <section className="rounded-2xl border border-line bg-panel p-6 sm:p-8">
        <h2 className="mb-1 text-lg font-semibold text-body">Configure your interview</h2>
        <p className="mb-8 text-[13px] text-faint">
          Everything below changes how the interviewer behaves, not just which problem you get.
        </p>
        <ConfigForm problems={problems} />
      </section>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 text-[11.5px] text-faint">
        <p>
          {problems.length} curated problems across arrays, graphs, dynamic programming and more.
        </p>
        <Link href="/sessions" className="transition-colors hover:text-muted">
          Past interviews →
        </Link>
      </footer>
    </main>
  );
}
