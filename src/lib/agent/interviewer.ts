import type { LlmMessage } from "@/lib/llm";
import { getProvider } from "@/lib/llm";
import type { AgentReply, Session, TranscriptTurn, TurnTrigger } from "@/lib/types";
import { latestRun } from "@/lib/store";
import { buildSystemPrompt } from "./prompts";
import { INTERVIEW_TOOLS, executeTool, flushEffects, type ToolEffects } from "./tools";
import { offlineReply } from "./offline";

const MAX_TOOL_ROUNDS = 5;
const HISTORY_TURNS = 30;

const COMPLEXITY_RE = /\bO\s*\(\s*[^)]{1,24}\)/i;
const CLARIFY_RE = /\?\s*$/;

/**
 * Signals that feed the final scorecard are derived from what the candidate
 * actually said, not from the model's opinion, so they stay stable whichever
 * provider is in use.
 */
export function updateSignalsFromCandidate(session: Session, text: string): void {
  const signals = session.signals;
  if (COMPLEXITY_RE.test(text)) signals.statedComplexity = true;
  if (CLARIFY_RE.test(text.trim())) signals.askedClarifyingQuestion = true;

  const codeStarted = signals.firstCodeAt !== null;
  const substantive = text.trim().split(/\s+/).length >= 12;
  if (!codeStarted && substantive) signals.explainedApproachBeforeCoding = true;
}

function triggerMessage(session: Session, trigger: TurnTrigger): string {
  switch (trigger.kind) {
    case "start":
      return "[The interview is starting now. Greet the candidate briefly, name the problem, and ask them to walk you through their approach before they write any code.]";
    case "candidate":
      return trigger.text;
    case "tests_ran": {
      const run = latestRun(session);
      if (!run) return "[The candidate ran the tests.]";
      if (run.compileError) {
        return "[The candidate just ran the tests and their code did not compile. Decide whether to respond, and if so point them at the error without naming the fix.]";
      }
      return `[The candidate just ran the tests: ${run.passed} of ${run.total} passing. Use get_test_results if you want the detail. Respond only if it is worth saying something.]`;
    }
    case "silence":
      return `[The candidate has said nothing for ${trigger.seconds} seconds. Decide whether to prompt them or stay quiet. Reply [SILENT] if a real interviewer would let the pause run.]`;
    case "code_change":
      return "[The candidate has been typing. Use read_editor_code if you want to look at what they have now. Only speak if something is genuinely worth asking about, otherwise reply [SILENT].]";
    case "time_warning":
      return `[${trigger.minutesLeft} minute(s) remain in the interview. Steer them towards wrapping up.]`;
    case "request_hint":
      return "[The candidate has explicitly asked for a hint. Call give_hint for the next level and paraphrase it.]";
  }
}

function buildHistory(transcript: TranscriptTurn[]): LlmMessage[] {
  const recent = transcript.slice(-HISTORY_TURNS);
  const messages: LlmMessage[] = [];

  for (const turn of recent) {
    const role: "user" | "assistant" =
      turn.speaker === "interviewer" ? "assistant" : "user";
    const content = turn.speaker === "system" ? `[${turn.text}]` : turn.text;

    // Merge consecutive same-role turns: both providers behave better on a
    // strictly alternating conversation.
    const last = messages[messages.length - 1];
    if (last && last.role !== "tool" && last.role === role) {
      last.content = `${last.content}\n${content}`;
      continue;
    }
    messages.push(
      role === "assistant" ? { role: "assistant", content } : { role: "user", content },
    );
  }

  // A conversation may not open on an assistant turn.
  while (messages.length && messages[0].role === "assistant") messages.shift();
  return messages;
}

function normaliseSpeech(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (/^\[?\s*silent\s*\]?$/i.test(trimmed)) return null;
  if (/\[SILENT\]/i.test(trimmed) && trimmed.replace(/\[SILENT\]/gi, "").trim() === "") {
    return null;
  }

  // Strip anything that would be read aloud as punctuation soup.
  return trimmed
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_#`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
}

export async function runInterviewerTurn(
  session: Session,
  trigger: TurnTrigger,
): Promise<AgentReply> {
  if (trigger.kind === "candidate") {
    updateSignalsFromCandidate(session, trigger.text);
  }

  const provider = getProvider();
  if (!provider) {
    const fallback = offlineReply(session, trigger);
    flushEffects(session, {
      hintLevel: fallback.hintLevel,
      events: fallback.events,
      phase: fallback.phase,
      ended: false,
      ranTests: false,
    });
    return fallback;
  }

  const effects: ToolEffects = {
    hintLevel: null,
    events: [],
    phase: null,
    ended: false,
    ranTests: false,
  };

  const system = buildSystemPrompt(session);
  const messages: LlmMessage[] = [
    ...buildHistory(session.transcript),
    { role: "user", content: triggerMessage(session, trigger) },
  ];

  try {
    const toolsUsed: string[] = [];

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const lastRound = round === MAX_TOOL_ROUNDS;
      const response = await provider.chat({
        system,
        messages,
        // On the final round, drop the tools so the model has to answer.
        tools: lastRound ? undefined : INTERVIEW_TOOLS,
        temperature: 0.75,
        maxTokens: 700,
      });

      if (!response.toolCalls.length || lastRound) {
        flushEffects(session, effects);
        return {
          speak: normaliseSpeech(response.text),
          toolsUsed,
          hintLevel: effects.hintLevel,
          events: effects.events,
          phase: effects.phase,
          offline: false,
        };
      }

      messages.push({
        role: "assistant",
        content: response.text,
        toolCalls: response.toolCalls,
      });

      const results: { id: string; name: string; result: unknown }[] = [];
      for (const call of response.toolCalls) {
        toolsUsed.push(call.name);
        const result = await executeTool(session, call.name, call.args, effects);
        results.push({ id: call.id, name: call.name, result });
      }
      messages.push({ role: "tool", results });

      if (effects.ended) {
        flushEffects(session, effects);
        return {
          speak: normaliseSpeech(response.text) ?? "That is time. Let us wrap up there.",
          toolsUsed,
          hintLevel: effects.hintLevel,
          events: effects.events,
          phase: "wrapup",
          offline: false,
        };
      }
    }

    flushEffects(session, effects);
    return {
      speak: null,
      toolsUsed,
      hintLevel: effects.hintLevel,
      events: effects.events,
      phase: effects.phase,
      offline: false,
    };
  } catch (error) {
    // A model outage must never end the interview. Apply whatever the tools
    // already did, then fall back to the rule-based interviewer.
    flushEffects(session, effects);
    console.error("[interviewer] model call failed, falling back:", error);
    const fallback = offlineReply(session, trigger);
    flushEffects(session, {
      hintLevel: fallback.hintLevel,
      events: fallback.events,
      phase: fallback.phase,
      ended: false,
      ranTests: false,
    });
    return { ...fallback, offline: true };
  }
}
