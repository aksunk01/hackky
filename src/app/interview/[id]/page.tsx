"use client";

import { use, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Editor from "@monaco-editor/react";
import { getProblem } from "@/lib/problems";
import type { ExecutionResult } from "@/lib/execute";
import { Button, DifficultyBadge, Logo } from "@/components/ui";
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
type InterviewEvent = "run" | "code-review";

type InterviewReply = {
  reply: string | null;
  mocked?: boolean;
  reason?: string;
};

/** Quiet typing after which Alex looks at the editor unprompted. */
const IDLE_REVIEW_MS = 12_000;
/** Non-whitespace characters of change worth a comment. */
const MIN_CODE_DELTA = 15;

function noSubscription() {
  return () => {};
}

function unsupported() {
  return false;
}

/**
 * Whether the editor has moved on enough to be worth an unprompted comment.
 * Deliberately conservative: every review costs a model call, and the free
 * Gemini tier runs out fast.
 */
function hasMeaningfulChange(next: string, seen: string): boolean {
  const a = next.replace(/\s+/g, "");
  const b = seen.replace(/\s+/g, "");
  return a !== b && Math.abs(a.length - b.length) >= MIN_CODE_DELTA;
}

export default function InterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const problem = getProblem(id);
  const router = useRouter();

  const [code, setCode] = useState(problem?.starterCode ?? "");
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [testResult, setTestResult] = useState<ExecutionResult | null>(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
  const chatEndRef = useRef<HTMLDivElement>(null);
  const greeted = useRef(false);
  // The editor contents Alex has already commented on, so an idle review only
  // fires for code he hasn't seen.
  const reviewedCode = useRef(problem?.starterCode ?? "");
  // State, but read from timers and callbacks that mustn't wait for a render.
  const busy = useRef(false);
  // The listener is started once and outlives many renders, so its callback has
  // to reach the current sendMessage rather than the one captured at start.
  const sendMessageRef = useRef<(text: string) => void>(() => {});

  useEffect(() => stopSpeaking, []);

  useEffect(() => {
    if (!problem || !micSupported || !micOn) return;

    const stop = startListening({
      onResult: (transcript) => {
        setPartial("");
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
  }, [problem?.id, micSupported, micOn]);

  // Re-pointed after every render so a transcript arriving at any moment is
  // sent against the current chat history, not the state captured at start.
  useEffect(() => {
    sendMessageRef.current = (text: string) => void sendMessage(text);
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
    if (!problem || messages.length === 0 || chatBusy) return;
    if (!hasMeaningfulChange(code, reviewedCode.current)) return;

    const timer = setTimeout(() => {
      void askInterviewer({ history: messages, event: "code-review" });
    }, IDLE_REVIEW_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, chatBusy, messages.length, problem?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, partial]);

  if (!problem) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Problem not found.</p>
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
  }) {
    if (busy.current) return;
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
          testResult: options.result ?? testResult,
          event: options.event,
        }),
      });
      const data = (await res.json()) as InterviewReply;
      setDemoReason(data.mocked ? (data.reason ?? "no-key") : null);
      // He stays quiet when an editor event can't be answered for real.
      if (!data.reply) return;
      setMessages((prev) => [...prev, { role: "model", text: data.reply! }]);
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
    if (!text || busy.current) return;
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

  async function runCode() {
    setRunning(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: problem!.id, code }),
      });
      const data = (await res.json()) as ExecutionResult;
      setTestResult(data);
      // A real interviewer watches the run and says something about it.
      await askInterviewer({ history: messages, event: "run", result: data });
    } finally {
      setRunning(false);
    }
  }

  async function submitInterview() {
    // Closing the mic runs the listener effect's cleanup.
    setMicOn(false);
    stopSpeaking();
    setSubmitting(true);
    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: problem!.id, history: messages, code }),
      });
      const data = await res.json();
      sessionStorage.setItem(
        "interview-result",
        JSON.stringify({ problem: problem!.title, ...data })
      );
      router.push("/results");
    } finally {
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
        <Button variant="danger" size="sm" onClick={submitInterview} disabled={submitting}>
          {submitting ? "Submitting…" : "End & Submit"}
        </Button>
      </header>

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
            <span className="text-sm font-medium text-muted">Python 3</span>
            <Button variant="secondary" size="sm" onClick={runCode} disabled={running}>
              {running ? "Running…" : "Run"}
            </Button>
          </div>
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              language="python"
              theme="vs-dark"
              value={code}
              onChange={(v) => setCode(v ?? "")}
              options={{ minimap: { enabled: false }, fontSize: 13 }}
            />
          </div>
          {testResult && (
            <div className="border-t border-border p-3 max-h-40 overflow-y-auto text-xs font-mono bg-subtle">
              {testResult.crashed ? (
                <pre className="text-danger whitespace-pre-wrap">{testResult.crashOutput}</pre>
              ) : (
                <>
                  <div
                    className={`mb-2 font-semibold ${
                      testResult.passed === testResult.total ? "text-success" : "text-foreground"
                    }`}
                  >
                    {testResult.passed}/{testResult.total} test cases passed
                  </div>
                  {testResult.results.map((r, i) => (
                    <div key={i} className={r.passed ? "text-success" : "text-danger"}>
                      {r.passed ? "✓" : "✗"} input={JSON.stringify(r.args)} expected={JSON.stringify(r.expected)}{" "}
                      got={JSON.stringify(r.actual)}
                      {r.error ? ` (${r.error})` : ""}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
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
                      ? "Gemini free-tier quota is exhausted, so replies are scripted and don't reflect your code."
                      : "No Gemini key, so replies are scripted and don't reflect your code."
                  }
                  className="text-xs font-normal text-warning bg-warning-soft rounded-full px-2 py-0.5"
                >
                  {demoReason === "quota" ? "scripted · quota hit" : "scripted · demo mode"}
                </span>
              )}
            </span>
            <button
              onClick={toggleVoice}
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
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={
                listening
                  ? mutedForSpeaking
                    ? "Mic off while Alex responds..."
                    : "Listening — just start talking..."
                  : "Type your response..."
              }
              className="flex-1 rounded-full border border-border-strong bg-transparent px-4 py-2 text-sm outline-none focus:border-accent transition-colors"
            />
            {micSupported && (
              <button
                type="button"
                onClick={() => setMicOn((prev) => !prev)}
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
            <Button type="submit" size="sm" disabled={chatBusy || !chatInput.trim()}>
              Send
            </Button>
          </form>
        </section>
      </main>
    </div>
  );
}
