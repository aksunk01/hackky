import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]";

const buttonVariants = {
  primary:
    "bg-accent text-accent-foreground hover:bg-accent-hover shadow-sm shadow-accent-soft",
  secondary:
    "border border-border-strong bg-card hover:bg-card-hover text-foreground",
  ghost: "hover:bg-subtle text-foreground",
  danger: "bg-danger text-white hover:opacity-90",
} as const;

const buttonSizes = {
  // Every interactive size clears the ~44px comfortable-tap-target guideline (Fitts's Law).
  sm: "text-sm px-3.5 py-2",
  md: "text-sm px-5 py-2.5",
  lg: "text-base px-7 py-3.5",
} as const;

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
}) {
  return (
    <button
      className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
      {...props}
    />
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`}
    >
      {children}
    </Link>
  );
}

const difficultyTone: Record<string, string> = {
  Easy: "text-success bg-success-soft",
  Medium: "text-warning bg-warning-soft",
  Hard: "text-danger bg-danger-soft",
};

export function DifficultyBadge({ level }: { level: string }) {
  const tone = difficultyTone[level] ?? "text-muted bg-subtle";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {level}
    </span>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold text-lg tracking-tight">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-foreground text-sm font-bold">
        A
      </span>
      InterviewAI
    </Link>
  );
}

export function SiteHeader({ active }: { active?: "practice" | "about" }) {
  return (
    <header className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-border">
      <Logo />
      <nav className="flex gap-6 text-sm">
        <Link
          href="/problems"
          className={`transition-colors ${
            active === "practice" ? "text-foreground font-medium" : "text-muted hover:text-foreground"
          }`}
        >
          Practice
        </Link>
        <Link href="/sessions" className="text-muted hover:text-foreground transition-colors">
          History
        </Link>
        <Link
          href="/about"
          className={`transition-colors ${
            active === "about" ? "text-foreground font-medium" : "text-muted hover:text-foreground"
          }`}
        >
          About
        </Link>
      </nav>
    </header>
  );
}
