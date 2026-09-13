import { LinkButton, SiteHeader } from "@/components/ui";
import { getAllProblems } from "@/lib/problems-store";
import { LANGUAGES } from "@/lib/languages";

const FEATURES = [
  {
    title: "Real interview pressure",
    body: "A live AI interviewer talks, listens, and reacts to your code in real time — not a static prompt.",
  },
  {
    title: "Think out loud",
    body: "Speak your reasoning like you would in a real loop. Voice in, voice out, no typing required.",
  },
  {
    title: "Scored like it counts",
    body: "Get a structured breakdown — problem solving, communication, correctness — after every session.",
  },
  {
    title: "Practice on your terms",
    body: "Run a free stopwatch or a strict time limit that auto-submits — whichever matches the pressure you want.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Pick a problem",
    body: "Search or filter by difficulty, then choose your language and how much time pressure you want.",
  },
  {
    step: "02",
    title: "Talk through your approach",
    body: "Alex greets you and asks how you'd solve it — out loud or typed, before you write a line of code.",
  },
  {
    step: "03",
    title: "Code with live feedback",
    body: "Run your code against real tests and get nudged, never handed the answer, if you drift off track.",
  },
  {
    step: "04",
    title: "Get a scored report",
    body: "Walk away with a breakdown across problem solving, communication, and correctness — saved to your history.",
  },
];

export default async function LandingPage() {
  const problems = await getAllProblems();
  return (
    <main className="flex-1 flex flex-col">
      <SiteHeader active="practice" />

      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 sm:py-28 gap-6 relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(600px circle at 50% 0%, var(--accent-soft), transparent 70%)",
          }}
        />
        <span className="animate-fade-up inline-flex items-center rounded-full border border-border-strong bg-card px-3 py-1 text-xs font-medium text-muted">
          Practice with a live AI interviewer
        </span>
        <h1
          className="animate-fade-up text-4xl sm:text-6xl font-bold max-w-3xl leading-[1.1] tracking-tight"
          style={{ animationDelay: "0.05s" }}
        >
          Real technical interviews,
          <br className="hidden sm:block" /> powered by AI.
        </h1>
        <p
          className="animate-fade-up text-muted max-w-md text-lg"
          style={{ animationDelay: "0.1s" }}
        >
          Solve. Explain. Talk. Improve.
        </p>
        <div className="animate-fade-up" style={{ animationDelay: "0.15s" }}>
          <LinkButton href="/problems" size="lg" className="mt-2">
            Start Interview
            <span aria-hidden>&rarr;</span>
          </LinkButton>
        </div>

        <dl className="animate-fade-up mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm" style={{ animationDelay: "0.2s" }}>
          {[
            [`${problems.length}`, "problems"],
            [`${LANGUAGES.length}`, "languages"],
            ["Live", "voice interview"],
            ["Instant", "scored reports"],
          ].map(([value, label]) => (
            <div key={label} className="flex items-baseline gap-1.5">
              <dt className="font-semibold text-foreground text-lg">{value}</dt>
              <dd className="text-muted">{label}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-t border-border bg-card/40 px-6 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-2"
            >
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border px-6 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">How it works</h2>
            <p className="text-muted">From picking a problem to a scored report, in one sitting.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s) => (
              <div key={s.step} className="flex flex-col gap-2">
                <span className="text-sm font-mono text-accent">{s.step}</span>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-card/40 px-6 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            Solve it in whatever you know best
          </h2>
          <p className="text-muted mb-8">
            Every problem supports all six languages — switch anytime without losing your progress.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {LANGUAGES.map((lang) => (
              <span
                key={lang.id}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium"
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ background: lang.color }}
                  aria-hidden
                />
                {lang.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border px-6 py-16 sm:py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
          Ready to see how you&rsquo;d actually do?
        </h2>
        <p className="text-muted mb-6 max-w-md mx-auto">
          Pick a problem and start talking through it — Alex is ready when you are.
        </p>
        <LinkButton href="/problems" size="lg">
          Start Interview
          <span aria-hidden>&rarr;</span>
        </LinkButton>
      </section>

      <footer className="border-t border-border px-6 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted">
        <span>InterviewAI</span>
        <span>Practice interviews, powered by Gemini, Claude &amp; ElevenLabs.</span>
      </footer>
    </main>
  );
}
