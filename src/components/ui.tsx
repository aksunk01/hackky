"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ButtonHTMLAttributes } from "react";

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

type ButtonStyleProps = {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
  className?: string;
};

function buttonClassName({ variant = "primary", size = "md", className = "" }: ButtonStyleProps) {
  return `${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${className}`;
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & ButtonStyleProps) {
  return <button className={buttonClassName({ variant, size, className })} {...props} />;
}

export function LinkButton({
  href,
  variant,
  size,
  className,
  children,
}: ButtonStyleProps & {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={buttonClassName({ variant, size, className })}>
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

function AccountIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UserMenu() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "anon" | "authed">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { email?: string | null } | null) => {
        setEmail(data?.email ?? null);
        setStatus(data ? "authed" : "anon");
      })
      .catch(() => setStatus("anon"));
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (status === "loading") return null;

  if (status === "anon") {
    return (
      <LinkButton href="/login" size="sm">
        Sign in
      </LinkButton>
    );
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong bg-subtle text-muted hover:bg-border-strong/60 hover:text-foreground transition-colors"
      >
        <AccountIcon />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-card shadow-lg py-1.5 z-10"
        >
          <div className="px-3.5 py-2 text-sm text-muted truncate border-b border-border">{email}</div>
          <button
            type="button"
            role="menuitem"
            onClick={logout}
            className="w-full text-left px-3.5 py-2 text-sm hover:bg-subtle transition-colors"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export function SiteHeader({ active }: { active?: "practice" | "about" }) {
  return (
    <header className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-border">
      <Logo />
      <nav className="flex items-center gap-6 text-sm">
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
        <UserMenu />
      </nav>
    </header>
  );
}
