"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientSession } from "@/lib/serialize";
import type { RunResult } from "@/lib/types";
import { DIFFICULTY_STYLE, formatClock, LANGUAGE_LABEL } from "@/lib/format";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useInterviewerVoice } from "@/hooks/useInterviewerVoice";
import { CodeEditor } from "./CodeEditor";
import { ProblemPanel } from "./ProblemPanel";
import { Transcript } from "./Transcript";
import { TestResults } from "./TestResults";
import { Timeline } from "./Timeline";

const CODE_SYNC_MS = 1500;
const SILENCE_THRESHOLD_MS = 45_000;
const CODE_PROBE_INTERVAL_MS = 70_000;
const TIME_WARNING_MIN = 2;

type TurnPayload =
  | { kind: "start" }
  | { kind: "candidate"; text: string }
  | { kind: "silence"; seconds: number }
  | { kind: "code_change" }
  | { kind: "time_warning"; minutesLeft: number }
  | { kind: "request_hint" };

export function InterviewRoom({ initial }: { initial: ClientSession }) {
  const router = useRouter();
  const [session, setSession] = useState<ClientSession>(initial);
  const [code, setCode] = useState(initial.code);
  const [thinking, setThinking] = useState(false);
  const [running, setRunning] = useState(false);
  const [ending, setEnding] = useState(false);
  const [typed, setTyped] = useState("");
  const [sidePanel, setSidePanel] = useState<"transcript" | "timeline">("transcript");
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState<string | null>(null);

  const voice = useInterviewerVoice();

  // Refs used by timers and callbacks that must not re-subscribe on every render.
  const codeRef = useRef(code);
  const busyRef = useRef(false);
  const queueRef = useRef<string[]>([]);
  const startedRef = useRef(false);
  const warnedRef = useRef(false);
  const lastProbeRef = useRef(Date.now());
  const lastCandidateAtRef = useRef(Date.now());
  const sessionRef = useRef(session);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const latestRun: RunResult | null = session.runs.length
    ? session.runs[session.runs.length - 1]
    : null;

  const totalMs = session.config.durationMin * 60_000;
  const elapsed = session.startedAt ? now - session.startedAt : 0;
  const remaining = Math.max(0, totalMs - elapsed);

  // --- the single serialised channel to the interviewer --------------------

  const sendTurn = useCallback(
    async (payload: TurnPayload) => {
      if (busyRef.current || sessionRef.current.endedAt) {
        // Never drop something the candidate actually said — queue it instead.
        if (payload.kind === "candidate") queueRef.current.push(payload.text);
        return;
      }
      busyRef.current = true;
      setThinking(true);
      try {
        const response = await fetch(`/api/session/${sessionRef.current.id}/turn`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...payload, code: codeRef.current }),
        });
        const data = await response.json();
        if (!response.ok) {
          setNotice(data.error ?? "The interviewer could not be reached.");
          return;
        }
        if (data.session) setSession(data.session);
        setThinking(false);
        if (data.reply?.speak) await voice.speak(data.reply.speak);
      } catch {
        setNotice("Lost connection to the interviewer. Your code is still saved.");
      } finally {
        busyRef.current = false;
        setThinking(false);

        const queued = queueRef.current.splice(0);
        if (queued.length) {
          void sendTurn({ kind: "candidate", text: queued.join(" ") });
        }
      }
    },
    [voice],
  );

  const handleFinalSpeech = useCallback(
    (text: string) => {
      lastCandidateAtRef.current = Date.now();
      void sendTurn({ kind: "candidate", text });
    },
    [sendTurn],
  );

  // The microphone is held closed while the interviewer speaks or thinks, so
  // its own voice is never transcribed back as the candidate's answer.
  const speech = useSpeechRecognition({
    onFinal: handleFinalSpeech,
    muted: voice.speaking || thinking,
  });

  // --- lifecycle -----------------------------------------------------------

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Opening line, exactly once.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (session.transcript.length === 0) void sendTurn({ kind: "start" });
  }, [session.transcript.length, sendTurn]);

  // Persist the editor contents so the interviewer's tools always read fresh code.
  useEffect(() => {
    if (code === session.code) return;
    const timer = setTimeout(() => {
      void fetch(`/api/session/${session.id}/code`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      }).catch(() => {});
    }, CODE_SYNC_MS);
    return () => clearTimeout(timer);
  }, [code, session.code, session.id]);

  // Ambient nudges: a long silence, or a stretch of typing worth asking about.
  useEffect(() => {
    const timer = setInterval(() => {
      const current = sessionRef.current;
      if (current.endedAt || busyRef.current || voice.speaking) return;

      const lastCandidate = current.transcript
        .filter((t) => t.speaker === "candidate")
        .slice(-1)[0];
      const lastCandidateAt = lastCandidate?.at ?? lastCandidateAtRef.current;
      const lastInterviewer = current.transcript
        .filter((t) => t.speaker === "interviewer")
        .slice(-1)[0];
      const lastInterviewerAt = lastInterviewer?.at ?? 0;
      const stamp = Date.now();

      // Only nudge when the candidate has had the floor and gone quiet.
      const quietFor = stamp - Math.max(lastCandidateAt, lastInterviewerAt);
      if (speech.listening && quietFor > SILENCE_THRESHOLD_MS) {
        lastCandidateAtRef.current = stamp;
        void sendTurn({ kind: "silence", seconds: Math.round(quietFor / 1000) });
        return;
      }

      if (
        stamp - lastProbeRef.current > CODE_PROBE_INTERVAL_MS &&
        codeRef.current.trim() !== current.problem.starter[current.config.language].trim() &&
        stamp - lastInterviewerAt > 25_000
      ) {
        lastProbeRef.current = stamp;
        void sendTurn({ kind: "code_change" });
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [sendTurn, speech.listening, voice.speaking]);

  const endInterview = useCallback(async () => {
    if (ending) return;
    setEnding(true);
    voice.stop();
    speech.stop();
    try {
      await fetch(`/api/session/${sessionRef.current.id}/end`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: codeRef.current }),
      });
    } catch {
      // The debrief page will retry generation if it has to.
    }
    router.push(`/report/${sessionRef.current.id}`);
  }, [ending, router, speech, voice]);

  // Time warning, then a hard stop.
  useEffect(() => {
    if (session.endedAt || ending) return;
    const minutesLeft = Math.ceil(remaining / 60_000);
    if (!warnedRef.current && remaining > 0 && minutesLeft <= TIME_WARNING_MIN) {
      warnedRef.current = true;
      void sendTurn({ kind: "time_warning", minutesLeft });
    }
    if (remaining <= 0) void endInterview();
  }, [remaining, session.endedAt, ending, sendTurn, endInterview]);

  // --- actions -------------------------------------------------------------

  async function runCode() {
    if (running || busyRef.current) return;
    setRunning(true);
    busyRef.current = true;
    try {
      const response = await fetch(`/api/session/${session.id}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: codeRef.current }),
      });
      const data = await response.json();
      if (!response.ok) {
        setNotice(data.error ?? "Could not run your code.");
        return;
      }
      setSession(data.session);
      setRunning(false);
      if (data.reply?.speak) {
        setThinking(false);
        await voice.speak(data.reply.speak);
      }
    } catch {
      setNotice("Could not reach the code runner.");
    } finally {
      setRunning(false);
      busyRef.current = false;
    }
  }

  function submitTyped(event: React.FormEvent) {
    event.preventDefault();
    const text = typed.trim();
    if (!text) return;
    setTyped("");
    handleFinalSpeech(text);
  }

  const hintCount = session.hints.length;
  const maxHint = session.hints.reduce((max, h) => Math.max(max, h.level), 0);
  const timeColour =
    remaining <= 120_000 ? "text-bad" : remaining <= 300_000 ? "text-warn" : "text-body";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink">
      {/* Header */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-panel px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-bad" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
            AI Interview
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[13px] font-medium text-body">
            {session.problem.title}
          </span>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${DIFFICULTY_STYLE[session.problem.difficulty]}`}
          >
            {session.problem.difficulty}
          </span>
          <span className="hidden shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] text-faint sm:inline">
            {LANGUAGE_LABEL[session.config.language]}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          {hintCount > 0 ? (
            <span className="rounded-full border border-hint/25 bg-hint/10 px-2.5 py-1 text-[11px] text-hint">
              {hintCount} hint{hintCount === 1 ? "" : "s"} · level {maxHint}
            </span>
          ) : null}

          <span className={`font-mono text-[15px] font-medium tabular-nums ${timeColour}`}>
            {formatClock(remaining)}
          </span>
          <span className="hidden text-[11px] text-faint sm:inline">remaining</span>

          <button
            type="button"
            onClick={() => void sendTurn({ kind: "request_hint" })}
            disabled={thinking || maxHint >= 4}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] text-muted transition-colors hover:border-hint/40 hover:text-hint disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ask for a hint
          </button>

          <button
            type="button"
            onClick={() => void endInterview()}
            disabled={ending}
            className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-1.5 text-[12px] font-medium text-bad transition-colors hover:bg-bad/20 disabled:opacity-50"
          >
            {ending ? "Wrapping up…" : "End interview"}
          </button>
        </div>
      </header>

      {notice ? (
        <div className="shrink-0 border-b border-warn/25 bg-warn/10 px-4 py-2 text-[12px] text-warn">
          {notice}
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="ml-3 underline underline-offset-2 opacity-70 hover:opacity-100"
          >
            dismiss
          </button>
        </div>
      ) : null}

      {/* Body */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-px overflow-y-auto bg-line lg:grid-cols-[minmax(250px,290px)_minmax(0,1fr)_minmax(300px,350px)] lg:overflow-hidden">
        <aside className="min-h-0 bg-panel lg:overflow-hidden">
          <ProblemPanel problem={session.problem} />
        </aside>

        <section className="flex min-h-0 flex-col bg-surface">
          <div className="min-h-[360px] flex-1 lg:min-h-0">
            <CodeEditor
              language={session.config.language}
              value={code}
              onChange={setCode}
              readOnly={Boolean(session.endedAt) || ending}
            />
          </div>

          <div className="shrink-0 border-t border-line bg-panel">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                Test results
              </span>
              <button
                type="button"
                onClick={() => void runCode()}
                disabled={running || ending}
                className="rounded-lg bg-accent px-4 py-1.5 text-[12.5px] font-semibold text-ink transition-all hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {running ? "Running…" : "Run Code"}
              </button>
            </div>
            <div className="border-t border-line-soft">
              <TestResults run={latestRun} running={running} />
            </div>
          </div>
        </section>

        <aside className="flex min-h-[420px] flex-col bg-panel lg:min-h-0">
          <div className="flex shrink-0 items-center gap-1 border-b border-line px-2 py-1.5">
            {(["transcript", "timeline"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setSidePanel(tab)}
                className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium capitalize transition-colors ${
                  sidePanel === tab
                    ? "bg-raised text-body"
                    : "text-faint hover:text-muted"
                }`}
              >
                {tab}
                {tab === "timeline" && session.timeline.length ? (
                  <span className="ml-1.5 text-[10px] text-faint">
                    {session.timeline.length}
                  </span>
                ) : null}
              </button>
            ))}

            <div className="ml-auto flex items-center gap-1.5 pr-1">
              {voice.speaking ? (
                <span className="speak-bar flex items-center gap-[2px]" aria-label="Interviewer speaking">
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (voice.enabled) voice.stop();
                  voice.setEnabled(!voice.enabled);
                }}
                title={voice.enabled ? "Mute the interviewer" : "Unmute the interviewer"}
                className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
                  voice.enabled ? "text-muted hover:text-body" : "text-faint"
                }`}
              >
                {voice.enabled ? "Voice on" : "Voice off"}
              </button>
            </div>
          </div>

          {sidePanel === "transcript" ? (
            <Transcript
              turns={session.transcript}
              interim={speech.interim}
              thinking={thinking}
            />
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <Timeline events={session.timeline} />
            </div>
          )}

          {/* Voice + text input */}
          <div className="shrink-0 border-t border-line p-3">
            {speech.error ? (
              <p className="mb-2 text-[11px] leading-relaxed text-warn">{speech.error}</p>
            ) : null}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={speech.toggle}
                disabled={!speech.supported || Boolean(session.endedAt)}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                  speech.listening
                    ? "listening-ring border-accent bg-accent/15 text-accent"
                    : "border-line bg-surface text-muted hover:border-accent/40 hover:text-accent"
                }`}
                title={speech.supported ? "Toggle microphone" : "Speech recognition is not supported in this browser"}
                aria-label="Toggle microphone"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
                </svg>
              </button>

              <form onSubmit={submitTyped} className="flex flex-1 items-center gap-2">
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={
                    speech.listening
                      ? "Listening — or type instead"
                      : speech.supported
                        ? "Turn on the mic, or type your answer"
                        : "Type your answer"
                  }
                  disabled={Boolean(session.endedAt)}
                  className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] text-body placeholder:text-faint focus:border-accent/40 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!typed.trim()}
                  className="rounded-lg border border-line bg-surface px-3 py-2 text-[12px] text-muted transition-colors hover:text-body disabled:opacity-30"
                >
                  Send
                </button>
              </form>
            </div>

            <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
              {speech.supported
                ? "Speak naturally — the mic pauses itself while the interviewer talks."
                : "This browser has no speech recognition. Chrome or Edge supports it; typing works everywhere."}
            </p>
          </div>
        </aside>
      </div>

      {ending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/85 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 px-6 text-center">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
            <div>
              <p className="text-[15px] font-medium text-body">Writing your debrief</p>
              <p className="mt-1 text-[12.5px] text-faint">
                Reviewing the transcript, your code and every test run.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
