import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="text-2xl font-semibold text-body">Interview not found</h1>
      <p className="max-w-sm text-[13.5px] leading-relaxed text-faint">
        That interview does not exist, or its session data was cleared.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-ink transition-all hover:bg-accent/90"
      >
        Start a new interview
      </Link>
    </main>
  );
}
