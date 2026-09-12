"use client";

import { use, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Editor from "@monaco-editor/react";
import { getProblem } from "@/lib/problems";
import type { ExecutionResult } from "@/lib/execute";
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
        <p className="text-black/60 dark:text-white/60">Problem not found.</p>
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

  return (
    <main className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)] gap-4 p-4 h-screen overflow-hidden">
      {/* Problem description */}
      <section className="flex flex-col rounded-xl border border-black/10 dark:border-white/10 overflow-y-auto p-5">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="font-semibold text-lg">{problem.title}</h1>
          <span className="text-xs text-green-600 dark:text-green-400">{problem.difficulty}</span>
        </div>
        <p className="text-xs text-black/40 dark:text-white/40 mb-4">{problem.tags}</p>
        <p className="text-sm leading-relaxed mb-4 whitespace-pre-wrap">{problem.description}</p>

        <h2 className="text-sm font-semibold mb-2">Examples</h2>
        <div className="flex flex-col gap-3 mb-4">
          {problem.examples.map((ex, i) => (
            <div key={i} className="text-xs bg-black/5 dark:bg-white/5 rounded-lg p-3 font-mono">
              <div>Input: {ex.input}</div>
              <div>Output: {ex.output}</div>
              {ex.explanation && <div className="text-black/50 dark:text-white/50">{ex.explanation}</div>}
            </div>
          ))}
        </div>

        <h2 className="text-sm font-semibold mb-2">Constraints</h2>
        <ul className="text-xs list-disc pl-4 text-black/60 dark:text-white/60 space-y-1">
          {problem.constraints.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </section>

      {/* Code editor */}
      <section className="flex flex-col rounded-xl border border-black/10 dark:border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-black/10 dark:border-white/10">
          <span className="text-sm font-medium">Python 3</span>
          <div className="flex gap-2">
            <button
              onClick={runCode}
              disabled={running}
              className="text-sm px-3 py-1.5 rounded-md bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 disabled:opacity-50"
            >
              {running ? "Running..." : "Run"}
            </button>
            <button
              onClick={submitInterview}
              disabled={submitting}
              className="text-sm px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
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
          <div className="border-t border-black/10 dark:border-white/10 p-3 max-h-40 overflow-y-auto text-xs font-mono">
            {testResult.crashed ? (
              <pre className="text-red-500 whitespace-pre-wrap">{testResult.crashOutput}</pre>
            ) : (
              <>
                <div className="mb-2 font-semibold">
                  {testResult.passed}/{testResult.total} test cases passed
                </div>
                {testResult.results.map((r, i) => (
                  <div key={i} className={r.passed ? "text-green-600 dark:text-green-400" : "text-red-500"}>
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
      <section className="flex flex-col rounded-xl border border-black/10 dark:border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-black/10 dark:border-white/10">
          <span className="text-sm font-medium">
            Alex · AI Interviewer
            {demoReason && (
              <span
                title={
                  demoReason === "quota"
                    ? "Gemini free-tier quota is exhausted, so replies are scripted and don't reflect your code."
                    : "No Gemini key, so replies are scripted and don't reflect your code."
                }
                className="ml-2 text-xs font-normal text-amber-600 dark:text-amber-400"
              >
                {demoReason === "quota" ? "scripted · quota hit" : "scripted · demo mode"}
              </span>
            )}
          </span>
          <button
            onClick={toggleVoice}
            className="text-xs px-2 py-1 rounded-md bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20"
          >
            Voice: {voiceOn ? "On" : "Off"}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.role === "model"
                  ? "self-start bg-black/5 dark:bg-white/10"
                  : "self-end bg-blue-600 text-white"
              }`}
            >
              {m.text}
            </div>
          ))}
          {partial && (
            <div className="self-end max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-blue-600/40 text-white italic">
              {partial}
            </div>
          )}
          {chatBusy && (
            <div className="self-start text-xs text-black/40 dark:text-white/40">Alex is typing...</div>
          )}
          <div ref={chatEndRef} />
        </div>
        <form
          className="flex gap-2 p-3 border-t border-black/10 dark:border-white/10"
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
                ? interviewerSpeaking
                  ? "Mic off while Alex responds..."
                  : "Listening — just start talking..."
                : "Type your response..."
            }
            className="flex-1 rounded-full border border-black/10 dark:border-white/10 bg-transparent px-4 py-2 text-sm outline-none focus:border-blue-500"
          />
          {micSupported && (
            <button
              type="button"
              onClick={() => setMicOn((prev) => !prev)}
              title={
                listening && interviewerSpeaking
                  ? "Muted while Alex responds"
                  : micOn
                    ? "Mute the microphone"
                    : "Unmute the microphone"
              }
              className={`rounded-full px-4 py-2 text-sm ${
                listening && interviewerSpeaking
                  ? "bg-amber-500 text-white"
                  : listening
                    ? "bg-red-600 text-white"
                    : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20"
              }`}
            >
              {!micOn ? "Mic off" : listening && interviewerSpeaking ? "Muted" : "Mic on"}
            </button>
          )}
          <button
            type="submit"
            disabled={chatBusy || !chatInput.trim()}
            className="rounded-full bg-blue-600 text-white px-4 py-2 text-sm disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </section>
    </main>
  );
}
