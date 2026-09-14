"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ComponentProps } from "react";
import { Button as ShadcnButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const textInputClass =
  "w-full rounded-xl border border-border-strong bg-card px-4 py-2.5 text-sm outline-none focus:border-accent transition-colors";

/** This app's own variant/size vocabulary, mapped onto the shadcn Button underneath. */
const variantMap = {
  primary: "default",
  secondary: "secondary",
  ghost: "ghost",
  danger: "destructive",
  link: "link",
} as const;

const sizeMap = {
  sm: "sm",
  md: "default",
  lg: "lg",
} as const;

type ButtonStyleProps = {
  variant?: keyof typeof variantMap;
  size?: keyof typeof sizeMap;
  className?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: Omit<ComponentProps<typeof ShadcnButton>, "variant" | "size"> & ButtonStyleProps) {
  return (
    <ShadcnButton
      variant={variantMap[variant]}
      size={sizeMap[size]}
      className={`rounded-full ${className ?? ""}`}
      {...props}
    />
  );
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
    <Button variant={variant} size={size} className={className} asChild>
      <Link href={href}>{children}</Link>
    </Button>
  );
}

const difficultyBadgeClass: Record<string, string> = {
  Easy: "!bg-success-soft !text-success",
  Medium: "!bg-warning-soft !text-warning",
  Hard: "!bg-danger-soft !text-danger",
};

export function DifficultyBadge({ level }: { level: string }) {
  return (
    <Badge variant="secondary" className={difficultyBadgeClass[level] ?? "!bg-subtle !text-muted"}>
      {level}
    </Badge>
  );
}

/** Shared shell for "this page's data couldn't load" states, e.g. a Firestore outage. */
export function UnavailableNotice({ title, message }: { title: string; message: string }) {
  return (
    <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-16">
      <Alert variant="destructive">
        <AlertTitle className="text-base">{title}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </main>
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

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { email?: string | null } | null) => {
        setEmail(data?.email ?? null);
        setStatus(data ? "authed" : "anon");
      })
      .catch(() => setStatus("anon"));
  }, []);

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong bg-subtle text-muted hover:bg-border-strong/60 hover:text-foreground transition-colors"
        >
          <AccountIcon />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={logout}>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteHeader({ active }: { active?: "practice" | "leaderboard" | "about" }) {
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
          href="/leaderboard"
          className={`transition-colors ${
            active === "leaderboard" ? "text-foreground font-medium" : "text-muted hover:text-foreground"
          }`}
        >
          Leaderboard
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
