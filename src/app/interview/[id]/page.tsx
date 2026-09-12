"use client";

import { use, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Editor from "@monaco-editor/react";
import { getProblem } from "@/lib/problems";
import type { ExecutionResult } from "@/lib/execute";
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speak,
  startListening,
  stopSpeaking,
} from "@/lib/voice";

type ChatTurn = { role: "user" | "model"; text: string };

const SPEECH_RATES = [1, 1.25, 1.5, 1.75, 2];

function noSubscription() {
  return () => {};
}

function unsupported() {
  return false;
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
    isSpeechRecognitionSupported,
    unsupported
  );
  const voiceSupported = useSyncExternalStore(
    noSubscription,
    isSpeechSynthesisSupported,
    unsupported
  );
  const [voiceOn, setVoiceOn] = useState(true);
  const [speechRateIndex, setSpeechRateIndex] = useState(1);
  const speechRate = SPEECH_RATES[speechRateIndex];
  const [listening, setListening] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const greeted = useRef(false);
  const stopListeningRef = useRef<(() => void) | null>(null);

  useEffect(() => stopSpeaking, []);

  useEffect(() => {
    if (!problem || greeted.current) return;
    greeted.current = true;
    setChatBusy(true);
    fetch("/api/interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemId: problem.id, history: [], code }),
    })
      .then((r) => r.json())
      .then((data) => {
        setMessages([{ role: "model", text: data.reply }]);
        if (voiceOn) speak(data.reply, speechRate);
      })
      .finally(() => setChatBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!problem) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-black/60 dark:text-white/60">Problem not found.</p>
      </main>
    );
  }

  async function sendMessage(overrideText?: string) {
    const text = (overrideText ?? chatInput).trim();
    if (!text || chatBusy) return;
    const nextHistory: ChatTurn[] = [...messages, { role: "user", text }];
    setMessages(nextHistory);
    setChatInput("");
    setChatBusy(true);
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: problem!.id, history: nextHistory, code }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "model", text: data.reply }]);
      if (voiceOn) speak(data.reply, speechRate);
    } finally {
      setChatBusy(false);
    }
  }

  function toggleListening() {
    if (listening) {
      stopListeningRef.current?.();
      stopListeningRef.current = null;
      setListening(false);
      return;
    }
    stopSpeaking();
    const stop = startListening(
      (transcript) => sendMessage(transcript),
      () => {
        setListening(false);
        stopListeningRef.current = null;
      }
    );
    if (stop) {
      stopListeningRef.current = stop;
      setListening(true);
    }
  }

  function toggleVoice() {
    setVoiceOn((prev) => {
      if (prev) stopSpeaking();
      return !prev;
    });
  }

  function cycleSpeechRate() {
    setSpeechRateIndex((prev) => (prev + 1) % SPEECH_RATES.length);
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
    } finally {
      setRunning(false);
    }
  }

  async function submitInterview() {
    stopListeningRef.current?.();
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
                {testResult.stdout && (
                  <div className="mt-3 pt-2 border-t border-black/10 dark:border-white/10">
                    <div className="font-semibold mb-1">Console output</div>
                    <pre className="whitespace-pre-wrap text-black/70 dark:text-white/70">
                      {testResult.stdout}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* Chat with AI interviewer */}
      <section className="flex flex-col rounded-xl border border-black/10 dark:border-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-black/10 dark:border-white/10">
          <span className="text-sm font-medium">Alex · AI Interviewer</span>
          {voiceSupported && (
            <div className="flex gap-2">
              <button
                onClick={cycleSpeechRate}
                disabled={!voiceOn}
                className="text-xs px-2 py-1 rounded-md bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 disabled:opacity-40"
              >
                {speechRate}x
              </button>
              <button
                onClick={toggleVoice}
                className="text-xs px-2 py-1 rounded-md bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20"
              >
                Voice: {voiceOn ? "On" : "Off"}
              </button>
            </div>
          )}
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
            placeholder={listening ? "Listening..." : "Type your response..."}
            className="flex-1 rounded-full border border-black/10 dark:border-white/10 bg-transparent px-4 py-2 text-sm outline-none focus:border-blue-500"
          />
          {micSupported && (
            <button
              type="button"
              onClick={toggleListening}
              disabled={chatBusy}
              className={`rounded-full px-4 py-2 text-sm disabled:opacity-50 ${
                listening
                  ? "bg-red-600 text-white animate-pulse"
                  : "bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20"
              }`}
            >
              {listening ? "Stop" : "Speak"}
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
