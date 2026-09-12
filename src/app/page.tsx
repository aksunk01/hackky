import { LinkButton, SiteHeader } from "@/components/ui";

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
];

export default function LandingPage() {
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
      </section>

      <section className="border-t border-border bg-card/40 px-6 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-3 gap-6">
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
    </main>
  );
}
