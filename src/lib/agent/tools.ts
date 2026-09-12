import type { LlmTool } from "@/lib/llm";
import type { EventKind, Phase, Session } from "@/lib/types";
import {
  addEvent,
  addHint,
  elapsedMs,
  latestRun,
  maxHintLevel,
  recordRun,
  remainingMs,
} from "@/lib/store";
import { runTests } from "@/lib/runner";
import { formatClock } from "./prompts";

export const INTERVIEW_TOOLS: LlmTool[] = [
  {
    name: "read_editor_code",
    description:
      "Read exactly what the candidate currently has in their code editor. Use this before commenting on their code so you never guess about what they wrote.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_problem",
    description:
      "Re-read the full problem, including the example cases and constraints the candidate can see.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "run_tests",
    description:
      "Run the candidate's current code against the full test suite, including the hidden tests. Use this when you want to check their work yourself, for example when they claim they are done. Tell them you are running it.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_test_results",
    description:
      "Read the results of the most recent test run without running anything new, including which hidden tests failed.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_interview_state",
    description:
      "Check elapsed time, remaining time, current phase, how many hints you have given, and whether the candidate has explained their approach or stated complexity.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "give_hint",
    description:
      "Obtain the authored hint for a given level, and record that you gave it. Level 1 is a guiding question that reveals nothing, level 4 is major assistance. Escalate one level at a time and only after real struggle. Paraphrase the returned text in your own words when you speak it.",
    parameters: {
      type: "object",
      properties: {
        level: {
          type: "integer",
          description: "Hint level from 1 (guiding question) to 4 (major assistance).",
        },
      },
      required: ["level"],
    },
  },
  {
    name: "note_moment",
    description:
      "Record a notable moment on the interview timeline, so the final debrief can explain itself. Use it for things like clarifying a constraint, identifying the optimal approach, going quiet for a long stretch, or missing an edge case.",
    parameters: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          description:
            "One of: good (a positive signal), warn (a concern), bad (a real mistake), info (neutral context).",
        },
        label: {
          type: "string",
          description: "Short third-person description, e.g. 'Identified the O(n) HashMap optimisation'.",
        },
      },
      required: ["kind", "label"],
    },
  },
  {
    name: "set_phase",
    description:
      "Move the interview to a new stage so pacing stays sensible. One of: intro, approach, coding, debugging, wrapup.",
    parameters: {
      type: "object",
      properties: {
        phase: { type: "string", description: "intro | approach | coding | debugging | wrapup" },
      },
      required: ["phase"],
    },
  },
  {
    name: "end_interview",
    description:
      "End the interview. Only call this when time is up or the candidate has genuinely finished and you have asked your closing questions.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Why you are ending it." },
      },
      required: ["reason"],
    },
  },
];

export interface ToolEffects {
  hintLevel: number | null;
  events: { kind: EventKind; label: string }[];
  phase: Phase | null;
  ended: boolean;
  ranTests: boolean;
}

const VALID_EVENT_KINDS: EventKind[] = ["good", "warn", "bad", "hint", "info"];
const VALID_PHASES: Phase[] = ["intro", "approach", "coding", "debugging", "wrapup"];

/** The interviewer's view of a run — unlike the candidate's, it shows hidden tests. */
function summariseRun(session: Session) {
  const run = latestRun(session);
  if (!run) return { ran: false, message: "The candidate has not run the tests yet." };
  if (run.compileError) {
    return {
      ran: true,
      compiled: false,
      compileError: run.compileError.slice(0, 600),
      message: "Their code does not compile.",
    };
  }
  return {
    ran: true,
    compiled: true,
    passed: run.passed,
    total: run.total,
    triggeredBy: run.trigger,
    failing: run.results
      .filter((r) => !r.passed)
      .slice(0, 6)
      .map((r) => ({
        label: r.label,
        hidden: r.hidden,
        input: r.input.slice(0, 200),
        expected: r.expected.slice(0, 120),
        actual: r.actual.slice(0, 120),
        error: r.error ? r.error.split("\n")[0].slice(0, 200) : null,
        timedOut: r.timedOut,
      })),
  };
}

export async function executeTool(
  session: Session,
  name: string,
  args: Record<string, unknown>,
  effects: ToolEffects,
): Promise<unknown> {
  switch (name) {
    case "read_editor_code":
      return {
        language: session.config.language,
        untouched:
          session.code.trim() ===
          session.problem.starter[session.config.language].trim(),
        lineCount: session.code.split("\n").length,
        code: session.code.slice(0, 8000),
      };

    case "get_problem":
      return {
        title: session.problem.title,
        difficulty: session.problem.difficulty,
        category: session.problem.category,
        description: session.problem.description,
        examples: session.problem.examples,
        constraints: session.problem.constraints,
        signature: `${session.problem.functionName}(${session.problem.paramNames.join(", ")})`,
      };

    case "run_tests": {
      const run = await runTests(
        session.problem,
        session.code,
        session.config.language,
        "interviewer",
      );
      recordRun(session, run);
      effects.ranTests = true;
      effects.events.push({
        kind: run.passed === run.total ? "good" : "info",
        label: `Interviewer ran the tests — ${run.passed}/${run.total} passing`,
      });
      return summariseRun(session);
    }

    case "get_test_results":
      return summariseRun(session);

    case "get_interview_state": {
      const signals = session.signals;
      return {
        elapsed: formatClock(elapsedMs(session)),
        remaining: formatClock(remainingMs(session)),
        phase: session.phase,
        hintsGiven: session.hints.length,
        highestHintLevel: maxHintLevel(session),
        explainedApproachBeforeCoding: signals.explainedApproachBeforeCoding,
        askedClarifyingQuestion: signals.askedClarifyingQuestion,
        statedComplexity: signals.statedComplexity,
        candidateTurns: session.transcript.filter((t) => t.speaker === "candidate").length,
        testRuns: session.runs.length,
      };
    }

    case "give_hint": {
      const raw = Number(args.level);
      const requested = Number.isFinite(raw) ? Math.round(raw) : 1;
      // Never let the model skip rungs — at most one level above what it has
      // already given. This is what keeps the hint ladder meaningful.
      const ceiling = Math.min(4, maxHintLevel(session) + 1);
      const level = Math.min(Math.max(requested, 1), ceiling) as 1 | 2 | 3 | 4;
      const ladder = session.problem.notes.hints;
      const text = [ladder.l1, ladder.l2, ladder.l3, ladder.l4][level - 1];
      addHint(session, level, text);
      effects.hintLevel = level;
      return {
        level,
        requestedLevel: requested,
        clampedBecause:
          requested > level
            ? "You cannot skip hint levels. Give this one first."
            : undefined,
        hint: text,
        instruction:
          "Paraphrase this into one or two spoken sentences. Do not read it out verbatim, and do not add anything stronger.",
      };
    }

    case "note_moment": {
      const kind = VALID_EVENT_KINDS.includes(args.kind as EventKind)
        ? (args.kind as EventKind)
        : "info";
      const label = String(args.label ?? "").slice(0, 160);
      if (label) effects.events.push({ kind, label });
      return { recorded: Boolean(label) };
    }

    case "set_phase": {
      const phase = VALID_PHASES.includes(args.phase as Phase)
        ? (args.phase as Phase)
        : null;
      if (phase) effects.phase = phase;
      return { phase: phase ?? session.phase };
    }

    case "end_interview":
      effects.ended = true;
      effects.events.push({
        kind: "info",
        label: `Interview ended — ${String(args.reason ?? "time").slice(0, 120)}`,
      });
      return { ended: true };

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

/** Applies queued timeline events once the agent turn has settled. */
export function flushEffects(session: Session, effects: ToolEffects): void {
  for (const event of effects.events) addEvent(session, event.kind, event.label);
  if (effects.phase) session.phase = effects.phase;
}
