"use client";

import { use, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Editor from "@monaco-editor/react";
import type { Problem } from "@/lib/problems";
import type { ExecutionResult } from "@/lib/execute";
import { LANGUAGES, type Language } from "@/lib/languages";
import { Button, DifficultyBadge, Logo } from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { RunResultPanel } from "@/components/run-result";
import { formatClock, timerConfigFromSearch, type TimerConfig } from "@/lib/timer";
import { aiProviderFromSearch, aiProviderLabel, type AiProvider } from "@/lib/ai";
import { hasRequiredApiKeys, type ApiKeyProvider } from "@/lib/api-key-providers";
import type { UserSettings } from "@/lib/users";
import { looksRandom } from "@/lib/noise";
import {
  isInterviewerSpeaking,
  isMicrophoneRecordingSupported,
  setInterviewerBusy,
  speak,
  startListening,
  stopSpeaking,
  subscribeSpeaking,
} from "@/lib/voice";

type ChatTurn = { role: "user" | "model"; text: string };

/** What the candidate did in the editor, when it wasn't them talking. */
type InterviewEvent = "run" | "code-review" | "periodic-check";

/** Whether the candidate was writing code or doing nothing during a periodic check's window. */
type ActivitySinceLastCheck = "idle" | "typing";

type InterviewReply = {
  reply: string | null;
  mocked?: boolean;
  /** Set when the reply came from the periodic direction check rather than the conversation. */
  checkIn?: boolean;
  reason?: string;
};

type SubmissionSnapshot = {
  id: string;
  problemId: string;
  history: ChatTurn[];
  code: string;
  language: Language;
  provider: AiProvider;
  runs: number;
  startedAt: string;
};

/** Quiet typing after which Alex looks at the editor unprompted. */
const IDLE_REVIEW_MS = 12_000;
/** Non-whitespace characters of change worth a comment. */
const MIN_CODE_DELTA = 15;
/** How often Alex checks in on direction, independent of the quick idle review above. */
const PERIODIC_CHECK_MS = 2 * 60_000;
/**
 * How often that window is re-tested. Shorter than the window itself on
 * purpose: a check-in that can't fire (mid-sentence, mid-reply) is retried
 * shortly after the blocker clears, instead of being pushed out a full two
 * minutes by a fixed-period interval.
 */
const CHECK_POLL_MS = 10_000;

/**
 * Visible tag marking a message as an unprompted direction check rather than a
 * reply. Display only — it is never passed to text-to-speech, which would read
 * the brackets and label out loud before the actual sentence.
 */
const CHECK_IN_LABEL = "🧭 [2-min check-in] ";

function noSubscription() {
  return () => {};
}

function unsupported() {
  return false;
}

/** The query string never changes during a mounted interview, so read it once. */
function getSearchSnapshot() {
  return window.location.search;
}

function getSearchServerSnapshot() {
  return "";
}

/**
 * Whether the editor has moved on enough to be worth an unprompted comment.
 * Deliberately conservative: every review costs a model call, and Gemini's
 * free tier runs out fast.
 */
function hasMeaningfulChange(next: string, seen: string): boolean {
  const a = next.replace(/\s+/g, "");
  const b = seen.replace(/\s+/g, "");
  return a !== b && Math.abs(a.length - b.length) >= MIN_CODE_DELTA;
}

/**
 * A pill trigger with a per-language color dot, opening a small menu — reads
 * as a real language switcher rather than a plain form control sitting in the
 * editor's header.
 */
function LanguagePicker({
  languages,
  value,
  onChange,
  disabled = false,
}: {
  languages: { id: Language; label: string; color: string }[];
  value: Language;
  onChange: (next: Language) => void;
  disabled?: boolean;
}) {
  const current = languages.find((lang) => lang.id === value) ?? languages[0];
  if (!current) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex items-center gap-2 rounded-full border border-border-strong bg-subtle pl-2.5 pr-2 py-1.5 text-sm font-medium hover:bg-border-strong/60 transition-colors"
        >
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ background: current.color }}
            aria-hidden
          />
          {current.label}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-muted" aria-hidden>
            <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {languages.map((lang) => (
          <DropdownMenuItem key={lang.id} onClick={() => onChange(lang.id)}>
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: lang.color }} aria-hidden />
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function InterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [problemStatus, setProblemStatus] = useState<"loading" | "found" | "not-found">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/problems/${id}`)
      .then((res) => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error("Failed to load problem.");
        return res.json() as Promise<Problem>;
      })
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setProblem(data);
          setProblemStatus("found");
        } else {
          setProblemStatus("not-found");
        }
      })
      .catch(() => {
        if (!cancelled) setProblemStatus("not-found");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Only offer languages this problem actually has starter code for.
  const availableLanguages = problem
    ? LANGUAGES.filter((lang) => problem.starterCode[lang.id])
    : [];
  const [language, setLanguage] = useState<Language>("python");
  // Kept per language so switching back doesn't throw away an attempt.
  const [drafts, setDrafts] = useState<Partial<Record<Language, string>>>({});
  const code = drafts[language] ?? "";
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [testResult, setTestResult] = useState<ExecutionResult | null>(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submissionLocked, setSubmissionLocked] = useState(false);
  const micSupported = useSyncExternalStore(
    noSubscription,
    isMicrophoneRecordingSupported,
    unsupported
  );
  // The mic is held closed while Alex talks, so say so rather than looking deaf.
  const interviewerSpeaking = useSyncExternalStore(
    subscribeSpeaking,
    isInterviewerSpeaking,
    unsupported
  );
  const [voiceOn, setVoiceOn] = useState(true);
  // Whether the user wants the mic open; the interviewer listens continuously.
  const [micOn, setMicOn] = useState(true);
  const [listening, setListening] = useState(false);
  // The utterance in progress, before it's a finished message.
  const [partial, setPartial] = useState("");
  const [demoReason, setDemoReason] = useState<string | null>(null);
  // Read from the URL the problem picker built (?timer=strict&minutes=N);
  // defaults to a free count-up clock when the interview was opened directly.
  const search = useSyncExternalStore(noSubscription, getSearchSnapshot, getSearchServerSnapshot);
  const timerConfig: TimerConfig = timerConfigFromSearch(search);
  const aiProvider = aiProviderFromSearch(search);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const sessionStart = useRef(Date.now());
  const autoSubmitted = useRef(false);
  const deadlineReachedRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const greeted = useRef(false);
  // The editor contents Alex has already commented on, so an idle review only
  // fires for code he hasn't seen.
  const reviewedCode = useRef("");
  // State, but read from timers and callbacks that mustn't wait for a render.
  const busy = useRef(false);
  const runningRef = useRef(false);
  const submittingRef = useRef(false);
  // The grader only sees the final run; the count tells it whether there was
  // ever anything to debug, so "never ran it" isn't scored as bad debugging.
  const runCountRef = useRef(0);
  const startedAtRef = useRef<string | null>(null);
  const submissionRef = useRef<SubmissionSnapshot | null>(null);
  // The listener is started once and outlives many renders, so its callback has
  // to reach the current sendMessage rather than the one captured at start.
  const sendMessageRef = useRef<(text: string) => void>(() => {});
  // The periodic direction check runs off a fixed interval rather than a
  // render, so it reads these refs instead of the state captured at mount.
  const codeRef = useRef(code);
  const messagesRef = useRef(messages);
  const codeAtLastCheck = useRef("");
  const talkedSinceLastCheck = useRef(false);
  // Runs once, the render after the problem finishes loading: seeds the
  // language, starter code, and idle-review baselines that used to be
  // available synchronously before the problem fetch was async.
  const problemInitialized = useRef(false);
  useEffect(() => {
    if (!problem || problemInitialized.current) return;
    problemInitialized.current = true;
    const initialLanguage =
      LANGUAGES.find((lang) => problem.starterCode[lang.id])?.id ?? "python";
    setLanguage(initialLanguage);
    setDrafts({ ...problem.starterCode });
    reviewedCode.current = problem.starterCode[initialLanguage] ?? "";
    codeAtLastCheck.current = problem.starterCode[initialLanguage] ?? "";
  }, [problem]);
  // Wall-clock start of the current silence window. Reset whenever Alex says
  // anything at all, so the check-in measures "two minutes since the last
  // thing either of us said" rather than ticking off a clock that started at
  // mount and can land seconds after his previous message.
  const lastCheckAt = useRef(Date.now());
  // A transcript in progress hasn't reached sendMessage/talkedSinceLastCheck
  // yet, so the interval needs its own live read of "is someone talking
  // right now" — otherwise a tick landing mid-sentence looks identical to
  // silence and the checker barges in over the candidate.
  const partialRef = useRef(partial);
  const interviewerSpeakingRef = useRef(interviewerSpeaking);
  // Same reason as sendMessageRef: the interval below is set up once, but
  // askInterviewer closes over whichever code/messages were current the
  // render it was defined in, so the interval must call through a ref that's
  // re-pointed every render instead of the closure it captured at mount.
  const askInterviewerRef = useRef<(options: {
    history: ChatTurn[];
    event?: InterviewEvent;
    result?: ExecutionResult | null;
    activity?: ActivitySinceLastCheck;
  }) => Promise<void>>(async () => {});
  // Re-pointed every render (see sendMessageRef/askInterviewerRef above) so
  // leaving the page — a client-side navigation that unmounts this component,
  // or an actual tab close/refresh — always finalizes against the latest
  // code/messages instead of whatever was current when the listener was set up.
  const finalizeOnLeaveRef = useRef<() => void>(() => {});

  useEffect(() => {
    finalizeOnLeaveRef.current = () => {
      // Nothing to salvage if the session never properly started (still
      // being auth/key-checked) or a submission is already underway.
      if (!authReady || !problem || submissionRef.current) return;
      const snapshot = buildSnapshot();
      submissionRef.current = snapshot;
      stopSpeaking();
      // `keepalive` lets the request outlive an actual page unload (tab
      // close/refresh); for an in-app navigation the tab stays alive anyway.
      void fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
        keepalive: true,
      }).catch(() => {});
    };
  });

  useEffect(() => {
    return () => {
      finalizeOnLeaveRef.current();
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    function handlePageHide() {
      finalizeOnLeaveRef.current();
    }
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, []);

  useEffect(() => {
    startedAtRef.current ??= new Date().toISOString();
    void checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAuth() {
    setAuthError("");
    const currentPath = window.location.pathname + window.location.search;
    try {
      const res = await fetch("/api/auth/me");
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(currentPath)}`);
        return;
      }
      if (!res.ok) throw new Error("Auth check failed.");

      const settingsRes = await fetch("/api/settings");
      if (settingsRes.status === 401) {
        router.push(`/login?next=${encodeURIComponent(currentPath)}`);
        return;
      }
      if (!settingsRes.ok) throw new Error("Settings check failed.");
      const settings = (await settingsRes.json()) as UserSettings;
      const isSet = Object.fromEntries(
        Object.entries(settings.apiKeys).map(([provider, key]) => [provider, key.isSet])
      ) as Record<ApiKeyProvider, boolean>;
      if (!hasRequiredApiKeys(isSet)) {
        router.push(`/settings?next=${encodeURIComponent(currentPath)}`);
        return;
      }

      setAuthReady(true);
    } catch {
      setAuthError("Your session could not be verified. Retry, or sign in again.");
    }
  }

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    partialRef.current = partial;
  }, [partial]);

  useEffect(() => {
    interviewerSpeakingRef.current = interviewerSpeaking;
  }, [interviewerSpeaking]);

  // Every couple of minutes, independent of whether anything else prompted a
  // reply, Alex looks at the editor and decides whether the candidate needs a
  // nudge — whether they've gone quiet or have been typing down a bad path.
  useEffect(() => {
    if (!problem) return;
    const interval = setInterval(() => {
      if (Date.now() - lastCheckAt.current < PERIODIC_CHECK_MS) return;
      // Mid-utterance, mid-reply, already submitted, or past the deadline:
      // retained for the next tick rather than lost — never talk over
      // someone, and never fire once the session is wrapping up.
      if (partialRef.current || interviewerSpeakingRef.current) return;
      if (busy.current || submissionRef.current || deadlineReachedRef.current) return;
      lastCheckAt.current = Date.now();
      const talked = talkedSinceLastCheck.current;
      const typed = hasMeaningfulChange(codeRef.current, codeAtLastCheck.current);
      codeAtLastCheck.current = codeRef.current;
      talkedSinceLastCheck.current = false;

      // An active conversation already gives Alex a channel to react in —
      // this check-in is only for the stretches where the candidate hasn't
      // said anything at all.
      if (talked) return;

      const activity: ActivitySinceLastCheck = typed ? "typing" : "idle";
      void askInterviewerRef.current({
        history: messagesRef.current,
        event: "periodic-check",
        activity,
      });
    }, CHECK_POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem?.id]);

  // Ticks off wall-clock time rather than accumulating +1 each interval, so a
  // throttled background tab still reports the real elapsed time on return.
  useEffect(() => {
    const tick = () => setElapsedSeconds(Math.floor((Date.now() - sessionStart.current) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const remainingSeconds =
    timerConfig.mode === "strict" ? timerConfig.minutes * 60 - elapsedSeconds : null;
  const timeExpired = remainingSeconds !== null && remainingSeconds <= 0;

  // Close the mic at the deadline, then wait for any run or interviewer reply
  // already in flight before freezing the completed code and transcript.
  useEffect(() => {
    if (!timeExpired) return;
    deadlineReachedRef.current = true;
    stopSpeaking();
    if (autoSubmitted.current || submittingRef.current || busy.current || runningRef.current || partial.trim() || !authReady) return;
    autoSubmitted.current = true;
    void submitInterview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeExpired, authReady, chatBusy, running, partial, submitting]);

  useEffect(() => {
    if (!problem || !micSupported || !micOn || timeExpired) return;

    const stop = startListening({
      onResult: (transcript) => {
        setPartial("");
        // Dropped before it ever becomes a chat turn or a network call — an
        // always-on mic transcribes coughs and room noise, and the candidate
        // never said anything that should count as part of the interview.
        if (looksRandom(transcript)) return;
        sendMessageRef.current(transcript);
      },
      // Shown live while the words are still coming out.
      onPartial: setPartial,
      onEnd: () => setListening(false),
    });
    if (!stop) return;

    setListening(true);
    return () => {
      stop();
      setListening(false);
      setPartial("");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem?.id, micSupported, micOn, timeExpired]);

  // Re-pointed after every render so a transcript arriving at any moment is
  // sent against the current chat history, not the state captured at start.
  useEffect(() => {
    sendMessageRef.current = (text: string) => void sendMessage(text);
  });

  useEffect(() => {
    askInterviewerRef.current = askInterviewer;
  });

  useEffect(() => {
    if (!problem || greeted.current) return;
    greeted.current = true;
    void askInterviewer({ history: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem?.id]);

  // Alex reads the editor on his own once the typing stops, so the candidate
  // gets feedback on what they wrote without having to narrate it.
  useEffect(() => {
    if (!problem || messages.length === 0 || chatBusy || submissionLocked) return;
    if (!hasMeaningfulChange(code, reviewedCode.current)) return;

    const timer = setTimeout(() => {
      void askInterviewer({ history: messages, event: "code-review" });
    }, IDLE_REVIEW_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, chatBusy, messages.length, problem?.id, submissionLocked]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, partial]);

  if (!problem) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">
          {problemStatus === "loading" ? "Loading…" : "Problem not found."}
        </p>
      </main>
    );
  }

  /**
   * Asks Alex for his next message. Every request carries the current editor
   * contents and the latest run, so his feedback can be about the actual code
   * whether the candidate spoke, ran the tests, or just typed.
   */
  async function askInterviewer(options: {
    history: ChatTurn[];
    event?: InterviewEvent;
    result?: ExecutionResult | null;
    activity?: ActivitySinceLastCheck;
  }) {
    if (busy.current || submissionRef.current || deadlineReachedRef.current) return;
    busy.current = true;
    setChatBusy(true);
    // Closed for the whole round trip, not just once his reply starts
    // playing: the model call plus TTS synthesis can take a few seconds, and
    // an open mic during that gap is exactly what let candidates talk over
    // the start of his reply.
    setInterviewerBusy(true);
    // Whatever is in the editor now is what he's being asked about, even if the
    // call fails — otherwise a failed review retries every keystroke.
    reviewedCode.current = code;
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId: problem!.id,
          history: options.history,
          code,
          language,
          provider: aiProvider,
          testResult: options.result ?? testResult,
          event: options.event,
          activity: options.activity,
          // Lets Alex answer "how much time do I have?" instead of treating it
          // as an off-topic remark.
          timer: {
            mode: timerConfig.mode,
            minutes: timerConfig.minutes,
            ...(remainingSeconds !== null ? { remainingSeconds } : {}),
          },
        }),
      });
      const data = (await res.json()) as InterviewReply;
      setDemoReason(data.mocked ? (data.reason ?? "no-key") : null);
      // He stays quiet when an editor event can't be answered for real.
      if (!data.reply) return;
      // Anything he says restarts the silence window, so a direction check
      // can't land right on the heels of a reply he just gave.
      lastCheckAt.current = Date.now();
      // Tagged for the transcript, untagged for the voice.
      const shown = data.checkIn ? `${CHECK_IN_LABEL}${data.reply}` : data.reply;
      setMessages((prev) => [...prev, { role: "model", text: shown }]);
      // speak() closes the mic itself (synchronously, before its own network
      // request) the moment it's called, so clearing busy right after — even
      // though speak() is still running in the background — leaves no gap.
      if (voiceOn) speak(data.reply);
    } finally {
      busy.current = false;
      setChatBusy(false);
      setInterviewerBusy(false);
    }
  }

  async function sendMessage(overrideText?: string) {
    const text = (overrideText ?? chatInput).trim();
    if (!text || busy.current || submissionRef.current || deadlineReachedRef.current) return;
    // The candidate has spoken, so the next periodic check should skip its
    // idle/typing nudge — this conversation turn already covers it.
    talkedSinceLastCheck.current = true;
    const nextHistory: ChatTurn[] = [...messages, { role: "user", text }];
    setMessages(nextHistory);
    setChatInput("");
    await askInterviewer({ history: nextHistory });
  }

  function toggleVoice() {
    setVoiceOn((prev) => {
      if (prev) stopSpeaking();
      return !prev;
    });
  }

  function setCode(next: string) {
    if (submissionRef.current || deadlineReachedRef.current) return;
    setDrafts((prev) => ({ ...prev, [language]: next }));
  }

  function switchLanguage(next: Language) {
    if (runningRef.current || submittingRef.current || submissionRef.current || deadlineReachedRef.current) return;
    // Alex hasn't seen the other buffer, but swapping languages isn't itself
    // progress worth interrupting him for — and the old run no longer applies.
    // Both baselines move: leaving codeAtLastCheck on the old language made the
    // swapped-in draft look like a burst of typing, so the next check-in
    // critiqued an implementation the candidate hadn't touched.
    reviewedCode.current = drafts[next] ?? "";
    codeAtLastCheck.current = drafts[next] ?? "";
    setTestResult(null);
    setLanguage(next);
  }

  async function runCode() {
    if (runningRef.current || submittingRef.current || submissionRef.current || deadlineReachedRef.current) return;
    runningRef.current = true;
    setRunning(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: problem!.id, code, language }),
      });
      const data = (await res.json()) as ExecutionResult;
      runCountRef.current += 1;
      setTestResult(data);
      // A real interviewer watches the run and says something about it.
      await askInterviewer({ history: messages, event: "run", result: data });
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }

  function buildSnapshot(): SubmissionSnapshot {
    return (
      submissionRef.current ?? {
        id: crypto.randomUUID(),
        problemId: problem!.id,
        history: messages.map(({ role, text }) => ({ role, text })),
        code,
        language,
        provider: aiProvider,
        runs: runCountRef.current,
        startedAt: startedAtRef.current ?? new Date().toISOString(),
      }
    );
  }

  async function submitInterview() {
    if (submittingRef.current || busy.current || runningRef.current || partial.trim() || !authReady) return;
    submittingRef.current = true;
    if (deadlineReachedRef.current) autoSubmitted.current = true;
    const snapshot = buildSnapshot();
    submissionRef.current = snapshot;
    setSubmissionLocked(true);
    setSubmitError("");
    // Closing the mic runs the listener effect's cleanup. The saved transcript
    // contains only completed turns, never a partial speech preview.
    setMicOn(false);
    stopSpeaking();
    setSubmitting(true);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error || "Could not save the report.");
      router.push(`/sessions/${data.id}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not save the report. Retry this submission.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  // Drives the mic button/placeholder in three places below, so compute once.
  const mutedForSpeaking = listening && interviewerSpeaking;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Slim workspace bar: orientation without competing with the task at hand. */}
      <header className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Logo />
          <span className="text-muted/50">/</span>
          <span className="font-medium text-sm truncate">{problem.title}</span>
          <DifficultyBadge level={problem.difficulty} />
        </div>
        <div className="flex items-center gap-3">
          {timerConfig.mode === "strict" ? (
            <span
              title="Strict mode: the interview auto-submits when this reaches 0:00."
              className={`text-xs font-mono px-2.5 py-1 rounded-full border tabular-nums ${
                remainingSeconds !== null && remainingSeconds <= 60
                  ? "border-danger text-danger bg-danger-soft animate-pulse-dot"
                  : remainingSeconds !== null && remainingSeconds <= timerConfig.minutes * 12
                    ? "border-warning text-warning bg-warning-soft"
                    : "border-border-strong text-muted"
              }`}
            >
              {formatClock(Math.max(0, remainingSeconds ?? 0))} left
            </span>
          ) : (
            <span
              title="Free timer: tracks elapsed time with no cutoff."
              className="text-xs font-mono px-2.5 py-1 rounded-full border border-border-strong text-muted tabular-nums"
            >
              {formatClock(elapsedSeconds)} elapsed
            </span>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={submitInterview}
            disabled={submitting || running || chatBusy || Boolean(partial.trim()) || !authReady}
          >
            {submitting ? "Submitting…" : submissionLocked ? "Retry Submit" : "End & Submit"}
          </Button>
        </div>
      </header>

      {(authError || submitError) && (
        <div className="px-4 py-2 text-sm text-danger border-b border-border shrink-0">
          {authError && (
            <span>
              {authError}{" "}
              <button type="button" onClick={() => void checkAuth()} className="underline">
                Retry setup
              </button>
            </span>
          )}
          {submitError && <span>{submitError} Retry Submit uses the same saved snapshot.</span>}
        </div>
      )}

      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)] gap-4 p-4">
        {/* Problem description */}
        <section className="flex flex-col rounded-2xl border border-border bg-card overflow-y-auto p-5">
          <p className="text-xs text-muted mb-3 uppercase tracking-wide">{problem.tags}</p>
          <p className="text-sm leading-relaxed mb-5 whitespace-pre-wrap">{problem.description}</p>

          <h2 className="text-sm font-semibold mb-2">Examples</h2>
          <div className="flex flex-col gap-3 mb-5">
            {problem.examples.map((ex, i) => (
              <div key={i} className="text-xs bg-subtle rounded-lg p-3 font-mono leading-relaxed">
                <div>Input: {ex.input}</div>
                <div>Output: {ex.output}</div>
                {ex.explanation && <div className="text-muted mt-1">{ex.explanation}</div>}
              </div>
            ))}
          </div>

          <h2 className="text-sm font-semibold mb-2">Constraints</h2>
          <ul className="text-xs list-disc pl-4 text-muted space-y-1">
            {problem.constraints.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </section>

        {/* Code editor */}
        <section className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <LanguagePicker
              languages={availableLanguages}
              value={language}
              onChange={switchLanguage}
              disabled={running || submissionLocked || timeExpired}
            />
            <Button variant="secondary" size="sm" onClick={runCode} disabled={running || submitting || submissionLocked || timeExpired}>
              {running ? "Running…" : "Run"}
            </Button>
          </div>
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              language={language}
              theme="vs-dark"
              value={code}
              onChange={(v) => setCode(v ?? "")}
              options={{ minimap: { enabled: false }, fontSize: 13, readOnly: submissionLocked || timeExpired }}
            />
          </div>
          {testResult && <RunResultPanel result={testResult} problem={problem!} />}
        </section>

        {/* Chat with AI interviewer */}
        <section className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <span className="text-sm font-medium flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full ${
                    interviewerSpeaking ? "bg-accent animate-pulse-dot" : "bg-success"
                  }`}
                />
              </span>
              Alex · AI Interviewer
              {demoReason && (
                <span
                  title={
                    demoReason === "quota"
                      ? `${aiProviderLabel(aiProvider)} free-tier quota is exhausted, so replies are scripted and don't reflect your code.`
                      : `No ${aiProviderLabel(aiProvider)} key, so replies are scripted and don't reflect your code.`
                  }
                  className="text-xs font-normal text-warning bg-warning-soft rounded-full px-2 py-0.5"
                >
                  {demoReason === "quota" ? "scripted · quota hit" : "scripted · demo mode"}
                </span>
              )}
            </span>
            <button
              onClick={toggleVoice}
              disabled={submissionLocked || timeExpired}
              className="text-xs px-2.5 py-1 rounded-full bg-subtle hover:bg-border-strong transition-colors"
            >
              Voice: {voiceOn ? "On" : "Off"}
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  m.role === "model"
                    ? "self-start bg-subtle"
                    : "self-end bg-accent text-accent-foreground"
                }`}
              >
                {m.text}
              </div>
            ))}
            {partial && (
              <div className="self-end max-w-[85%] rounded-2xl px-3.5 py-2 text-sm bg-accent/40 text-accent-foreground italic">
                {partial}
              </div>
            )}
            {chatBusy && (
              <div className="self-start text-xs text-muted flex items-center gap-1.5">
                <span className="flex gap-0.5">
                  <span className="h-1 w-1 rounded-full bg-muted animate-pulse-dot" />
                  <span
                    className="h-1 w-1 rounded-full bg-muted animate-pulse-dot"
                    style={{ animationDelay: "0.15s" }}
                  />
                  <span
                    className="h-1 w-1 rounded-full bg-muted animate-pulse-dot"
                    style={{ animationDelay: "0.3s" }}
                  />
                </span>
                Alex is typing
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <form
            className="flex gap-2 p-3 border-t border-border"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
          >
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={submissionLocked || timeExpired}
              placeholder={
                listening
                  ? mutedForSpeaking
                    ? "Mic off while Alex responds..."
                    : "Listening — just start talking..."
                  : "Type your response..."
              }
              className="flex-1 rounded-full bg-transparent"
            />
            {micSupported && (
              <button
                type="button"
                onClick={() => setMicOn((prev) => !prev)}
                disabled={submissionLocked || timeExpired}
                title={
                  mutedForSpeaking
                    ? "Muted while Alex responds"
                    : micOn
                      ? "Mute the microphone"
                      : "Unmute the microphone"
                }
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  mutedForSpeaking
                    ? "bg-warning text-white"
                    : listening
                      ? "bg-danger text-white"
                      : "bg-subtle hover:bg-border-strong"
                }`}
              >
                {!micOn ? "Mic off" : mutedForSpeaking ? "Muted" : "Mic on"}
              </button>
            )}
            <Button type="submit" size="sm" disabled={chatBusy || submissionLocked || timeExpired || !chatInput.trim()}>
              Send
            </Button>
          </form>
        </section>
      </main>
    </div>
  );
}
