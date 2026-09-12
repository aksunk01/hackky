import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex-1 flex flex-col">
      <header className="flex items-center justify-between px-8 py-5 border-b border-black/10 dark:border-white/10">
        <span className="font-semibold text-lg">InterviewAI</span>
        <nav className="flex gap-6 text-sm text-black/60 dark:text-white/60">
          <Link href="/problems" className="hover:text-blue-600">Practice</Link>
          <Link href="/sessions" className="hover:text-blue-600">History</Link>
          <span>About</span>
        </nav>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 gap-6">
        <h1 className="text-4xl sm:text-5xl font-bold max-w-2xl">
          Real Technical Interviews. Powered by AI.
        </h1>
        <p className="text-black/60 dark:text-white/60 max-w-md">
          Solve. Explain. Talk. Improve.
        </p>
        <Link
          href="/problems"
          className="mt-2 inline-flex items-center rounded-full bg-blue-600 text-white px-6 py-3 font-medium hover:bg-blue-700 transition-colors"
        >
          Start Interview
        </Link>
      </section>
    </main>
  );
}
