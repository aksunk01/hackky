import { extractJson, getProvider } from "@/lib/llm";
import type {
  CommunicationSignals,
  Report,
  ScoreLine,
  Session,
} from "@/lib/types";
import { elapsedMs, latestRun, maxHintLevel } from "@/lib/store";
import { buildAssessmentPrompt, formatClock } from "./prompts";

const clamp = (n: number, lo = 0, hi = 10) => Math.max(lo, Math.min(hi, Math.round(n)));

const WEIGHTS: Record<string, number> = {
  "Problem Understanding": 1,
  Communication: 1.4,
  "Algorithm Selection": 1.3,
  Implementation: 1.2,
  Debugging: 1,
  "Complexity Analysis": 1.1,
  "Code Quality": 0.8,
};

// --- evidence --------------------------------------------------------------

interface Evidence {
  candidateTurns: number;
  candidateWords: number;
  wordsPerMinute: number;
  longestSilenceMs: number;
  runs: number;
  compiled: boolean;
  passed: number;
  total: number;
  hiddenPassed: number;
  hiddenTotal: number;
  perfTestsPassed: boolean;
  hintCount: number;
  maxHint: number;
  improvedAcrossRuns: boolean;
  codeQuality: { score: number; note: string };
}

function analyseCodeQuality(code: string): { score: number; note: string } {
  const lines = code.split("\n").filter((l) => l.trim().length > 0);
  if (!lines.length) return { score: 0, note: "Nothing was written." };

  const identifiers = code.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) ?? [];
  const singleChar = identifiers.filter((id) => id.length === 1).length;
  const singleCharRatio = identifiers.length ? singleChar / identifiers.length : 0;
  const longLines = lines.filter((l) => l.length > 110).length;
  const maxIndent = Math.max(
    ...lines.map((l) => (l.match(/^[\t ]*/)?.[0].length ?? 0)),
  );
  const hasComments = /(^|\s)(\/\/|#)(?!\s*(Write your solution|Definition for))/m.test(code);

  let score = 8;
  const notes: string[] = [];

  if (singleCharRatio > 0.3) {
    score -= 2;
    notes.push("heavy use of single-letter names");
  } else if (singleCharRatio < 0.12) {
    score += 1;
    notes.push("clear naming");
  }
  if (longLines > 2) {
    score -= 1;
    notes.push(`${longLines} very long lines`);
  }
  if (maxIndent > 20) {
    score -= 1;
    notes.push("deep nesting");
  }
  if (hasComments) {
    score += 1;
    notes.push("commented where it helps");
  }
  if (lines.length > 70) {
    score -= 1;
    notes.push("longer than the problem needs");
  }

  return {
    score: clamp(score),
    note: notes.length ? notes.join(", ") : "straightforward and readable",
  };
}

function gatherEvidence(session: Session): Evidence {
  const candidate = session.transcript.filter((t) => t.speaker === "candidate");
  const candidateWords = candidate.reduce(
    (sum, t) => sum + t.text.trim().split(/\s+/).filter(Boolean).length,
    0,
  );
  const minutes = Math.max(1, elapsedMs(session) / 60_000);

  // Longest gap between consecutive candidate utterances.
  let longestSilenceMs = 0;
  let previous = session.startedAt ?? session.createdAt;
  for (const turn of candidate) {
    longestSilenceMs = Math.max(longestSilenceMs, turn.at - previous);
    previous = turn.at;
  }
  const end = session.endedAt ?? Date.now();
  longestSilenceMs = Math.max(longestSilenceMs, end - previous);

  const run = latestRun(session);
  const hidden = run?.results.filter((r) => r.hidden) ?? [];
  const perfTests =
    run?.results.filter((r) => /large|rejects|\d+k |nodes|deeply/i.test(r.label)) ?? [];

  const passedSeries = session.runs.map((r) => r.passed);
  const improved =
    passedSeries.length > 1 &&
    passedSeries[passedSeries.length - 1] > Math.min(...passedSeries);

  return {
    candidateTurns: candidate.length,
    candidateWords,
    wordsPerMinute: candidateWords / minutes,
    longestSilenceMs,
    runs: session.runs.length,
    compiled: run ? run.compiled : false,
    passed: run?.passed ?? 0,
    total: run?.total ?? session.problem.tests.length,
    hiddenPassed: hidden.filter((r) => r.passed).length,
    hiddenTotal: hidden.length,
    perfTestsPassed: perfTests.length > 0 && perfTests.every((r) => r.passed),
    hintCount: session.hints.length,
    maxHint: maxHintLevel(session),
    improvedAcrossRuns: improved,
    codeQuality: analyseCodeQuality(session.code),
  };
}

// --- deterministic scoring -------------------------------------------------

function deterministicScores(session: Session, e: Evidence): ScoreLine[] {
  const passRate = e.total ? e.passed / e.total : 0;
  const signals = session.signals;

  const understanding = clamp(
    4 +
      (signals.askedClarifyingQuestion ? 2.5 : 0) +
      (signals.explainedApproachBeforeCoding ? 2.5 : -1) +
      passRate * 2,
  );

  const talkScore = Math.min(4, e.wordsPerMinute / 12);
  const silencePenalty = e.longestSilenceMs > 150_000 ? 3 : e.longestSilenceMs > 90_000 ? 1.5 : 0;
  const communication = clamp(
    3 + talkScore + (e.candidateTurns >= 6 ? 2 : e.candidateTurns >= 3 ? 1 : 0) - silencePenalty,
  );

  const algorithm = clamp(
    3 + passRate * 4 + (e.perfTestsPassed ? 2 : 0) - e.maxHint * 0.8,
  );

  const implementation = clamp(
    e.compiled ? 3 + passRate * 6.5 : 1 + passRate * 2,
  );

  const debugging = clamp(
    e.runs === 0
      ? 2
      : 4 +
          (e.improvedAcrossRuns ? 2.5 : 0) +
          (passRate === 1 ? 2 : 0) -
          (e.maxHint >= 3 ? 2 : 0) -
          (e.runs > 8 ? 1 : 0),
  );

  const complexity = clamp(signals.statedComplexity ? 6 + (e.perfTestsPassed ? 2.5 : 0) : 2);

  return [
    {
      category: "Problem Understanding",
      score: understanding,
      feedback: signals.askedClarifyingQuestion
        ? "Clarified the problem before committing to an approach."
        : "Started without asking any clarifying questions about the input or edge cases.",
    },
    {
      category: "Communication",
      score: communication,
      feedback:
        e.candidateTurns === 0
          ? "Did not speak during the interview, so there was nothing to assess."
          : e.longestSilenceMs > 90_000
            ? `Explained the opening well but went quiet for ${formatClock(e.longestSilenceMs)} at the longest stretch.`
            : "Kept the interviewer with them through most of the session.",
    },
    {
      category: "Algorithm Selection",
      score: algorithm,
      feedback: e.perfTestsPassed
        ? `Reached a solution that holds up at the input limits (${session.problem.notes.optimalTime} is what this problem wants).`
        : `Did not reach the ${session.problem.notes.optimalTime} approach this problem is looking for.`,
    },
    {
      category: "Implementation",
      score: implementation,
      feedback: !e.compiled
        ? "The final code did not compile or run."
        : `${e.passed} of ${e.total} tests passing at the end of the interview.`,
    },
    {
      category: "Debugging",
      score: debugging,
      feedback:
        e.runs === 0
          ? "Never ran the tests, so nothing was verified."
          : e.improvedAcrossRuns
            ? "Used failing cases to find and fix real problems."
            : "Did not make progress against the failing cases across runs.",
    },
    {
      category: "Complexity Analysis",
      score: complexity,
      feedback: signals.statedComplexity
        ? "Stated the complexity of their solution."
        : `Never stated a time or space complexity. The optimal here is ${session.problem.notes.optimalTime} time and ${session.problem.notes.optimalSpace} space.`,
    },
    {
      category: "Code Quality",
      score: e.codeQuality.score,
      feedback: e.codeQuality.note,
    },
  ];
}

function deterministicCommunication(session: Session, e: Evidence): CommunicationSignals {
  const answered = session.transcript.filter((t) => t.speaker === "candidate").length;
  const asked = session.transcript.filter((t) => t.speaker === "interviewer").length;
  const responseRate = asked ? Math.min(1, answered / asked) : 0;
  const avgWords = answered ? e.candidateWords / answered : 0;

  return {
    thinkingAloud: clamp(2 + Math.min(6, e.wordsPerMinute / 10) + (e.longestSilenceMs > 120_000 ? -2 : 1)),
    explanationClarity: clamp(4 + (avgWords > 8 ? 2 : 0) + (avgWords > 60 ? -2 : 1) + (e.passed === e.total ? 1 : 0)),
    questionHandling: clamp(3 + responseRate * 6),
    conciseness: clamp(avgWords === 0 ? 0 : avgWords > 90 ? 4 : avgWords > 45 ? 6 : avgWords > 6 ? 9 : 5),
    technicalReasoning: clamp(3 + (session.signals.statedComplexity ? 2 : 0) + (e.perfTestsPassed ? 3 : 0) - e.maxHint * 0.5 + 1),
  };
}

function overallFrom(scores: ScoreLine[]): number {
  const totalWeight = scores.reduce((s, line) => s + (WEIGHTS[line.category] ?? 1), 0);
  const weighted = scores.reduce(
    (s, line) => s + line.score * (WEIGHTS[line.category] ?? 1),
    0,
  );
  return Math.round((weighted / totalWeight) * 10);
}

function verdictFrom(overall: number): Report["verdict"] {
  if (overall >= 85) return "strong hire";
  if (overall >= 72) return "hire";
  if (overall >= 60) return "lean hire";
  if (overall >= 45) return "borderline";
  return "no hire";
}

function hintSummary(session: Session): string {
  if (!session.hints.length) return "No hints were needed.";
  const max = maxHintLevel(session);
  const descriptor =
    max <= 1 ? "only nudges" : max === 2 ? "conceptual pointers" : max === 3 ? "a named strategy" : "substantial help";
  return `${session.hints.length} hint${session.hints.length === 1 ? "" : "s"}, up to level ${max} — ${descriptor}.`;
}

/** The report produced with no model available, and the floor under the LLM one. */
export function buildDeterministicReport(session: Session): Report {
  const e = gatherEvidence(session);
  const scorecard = deterministicScores(session, e);
  const overall = overallFrom(scorecard);
  const notes = session.problem.notes;

  const didWell: string[] = [];
  const hurtYou: string[] = [];

  if (session.signals.askedClarifyingQuestion) {
    didWell.push("You clarified the problem before writing code, which is exactly the right instinct.");
  }
  if (session.signals.explainedApproachBeforeCoding) {
    didWell.push("You talked through your approach before implementing it.");
  }
  if (e.perfTestsPassed) {
    didWell.push(`You reached a solution that holds up at the input limits, not just on the small examples.`);
  }
  if (e.improvedAcrossRuns) {
    didWell.push("You used the failing tests to drive real fixes rather than guessing.");
  }
  if (session.signals.statedComplexity) {
    didWell.push("You stated the complexity of your solution without being chased for it.");
  }
  if (!didWell.length) {
    didWell.push("You engaged with the problem and produced working code to talk about.");
  }

  if (!session.signals.explainedApproachBeforeCoding) {
    hurtYou.push("You started implementing before explaining your plan, so the interviewer could not follow your reasoning.");
  }
  if (e.longestSilenceMs > 90_000) {
    hurtYou.push(`You went quiet for ${formatClock(e.longestSilenceMs)} at one point. In a real interview that silence costs you.`);
  }
  if (!session.signals.statedComplexity) {
    hurtYou.push(`You never stated a time or space complexity. For this problem the answer is ${notes.optimalTime} time and ${notes.optimalSpace} space.`);
  }
  if (e.maxHint >= 3) {
    hurtYou.push(`You needed a level ${e.maxHint} hint, which means the approach did not come from you.`);
  } else if (e.hintCount >= 2) {
    hurtYou.push(`You needed ${e.hintCount} hints to get moving. Interviewers weigh that against you even when the final code is correct.`);
  }
  if (e.passed < e.total) {
    hurtYou.push(`You finished with ${e.total - e.passed} test${e.total - e.passed === 1 ? "" : "s"} still failing.`);
  }
  if (!hurtYou.length) {
    hurtYou.push("Nothing significant went wrong — tighten the explanation and this is a clean interview.");
  }

  const focusNext: string[] = [];
  if (!session.signals.statedComplexity) focusNext.push("State the time and space complexity of every solution out loud, unprompted.");
  if (e.longestSilenceMs > 90_000) focusNext.push("Practise narrating while you type — even a sentence every thirty seconds keeps the interviewer with you.");
  if (!session.signals.askedClarifyingQuestion) focusNext.push(`Open with clarifying questions. For this problem: ${notes.clarifications[0]}`);
  if (e.maxHint >= 2) focusNext.push(`Drill ${session.problem.category} until the core pattern is automatic.`);
  if (!focusNext.length) focusNext.push("Try the same problem at a harder difficulty, or under a shorter clock.");

  return {
    generatedAt: Date.now(),
    overall,
    verdict: verdictFrom(overall),
    headline:
      e.passed === e.total && e.compiled
        ? `Working solution with ${session.signals.statedComplexity ? "solid" : "incomplete"} communication around it.`
        : `Finished with ${e.passed} of ${e.total} tests passing.`,
    scorecard,
    communication: deterministicCommunication(session, e),
    technical: {
      compiles: e.compiled,
      testsPassed: e.passed,
      testsTotal: e.total,
      hiddenPassed: e.hiddenPassed,
      hiddenTotal: e.hiddenTotal,
      statedTime: null,
      statedSpace: null,
      optimalTime: notes.optimalTime,
      optimalSpace: notes.optimalSpace,
      approachSummary: e.perfTestsPassed
        ? "Reached a solution efficient enough for the stated limits."
        : "The submitted solution does not meet the complexity this problem targets.",
      edgeCases:
        e.hiddenTotal === 0
          ? "No hidden tests were run."
          : `${e.hiddenPassed} of ${e.hiddenTotal} hidden edge-case tests passed.`,
      readability: e.codeQuality.note,
    },
    hintsUsed: { count: e.hintCount, maxLevel: e.maxHint, summary: hintSummary(session) },
    didWell: didWell.slice(0, 4),
    hurtYou: hurtYou.slice(0, 3),
    momentToImprove: null,
    focusNext: focusNext.slice(0, 3),
    offline: true,
  };
}

// --- LLM-written report ----------------------------------------------------

interface LlmReportShape {
  headline?: string;
  verdict?: string;
  scorecard?: { category: string; score: number; feedback: string }[];
  communication?: Partial<CommunicationSignals>;
  technical?: {
    statedTime?: string | null;
    statedSpace?: string | null;
    approachSummary?: string;
    edgeCases?: string;
    readability?: string;
  };
  didWell?: string[];
  hurtYou?: string[];
  momentToImprove?: {
    moment: string;
    whatYouSaid: string;
    betterExplanation: string;
  } | null;
  focusNext?: string[];
}

function buildEvidenceBundle(session: Session, e: Evidence): string {
  const run = latestRun(session);
  const transcript = session.transcript
    .map((t) => `[${formatClock(t.elapsed)}] ${t.speaker.toUpperCase()}: ${t.text}`)
    .join("\n");

  const timeline = session.timeline
    .map((t) => `[${formatClock(t.elapsed)}] (${t.kind}) ${t.label}`)
    .join("\n");

  const runHistory = session.runs
    .map(
      (r, i) =>
        `run ${i + 1} at ${formatClock(r.at - (session.startedAt ?? r.at))} by ${r.trigger}: ${
          r.compileError ? "did not compile" : `${r.passed}/${r.total} passing`
        }`,
    )
    .join("\n");

  const failing = (run?.results ?? [])
    .filter((r) => !r.passed)
    .slice(0, 8)
    .map((r) => `- ${r.label}${r.hidden ? " (hidden)" : ""}: expected ${r.expected}, got ${r.actual}`)
    .join("\n");

  return `INTERVIEW DURATION: ${formatClock(elapsedMs(session))} of ${session.config.durationMin} minutes
LANGUAGE: ${session.config.language}
INTERVIEW STYLE: ${session.config.style}

FULL TRANSCRIPT
${transcript || "(the candidate never spoke)"}

TIMELINE OF NOTABLE MOMENTS
${timeline || "(nothing was flagged)"}

TEST RUN HISTORY
${runHistory || "(the candidate never ran the tests)"}

FINAL TEST RESULT: ${run ? `${run.passed}/${run.total} passing${run.compileError ? " — did not compile" : ""}` : "never run"}
HIDDEN EDGE-CASE TESTS: ${e.hiddenPassed}/${e.hiddenTotal} passing
${failing ? `STILL FAILING AT THE END:\n${failing}` : ""}

HINTS GIVEN
${session.hints.length ? session.hints.map((h) => `[${formatClock(h.elapsed)}] level ${h.level}: ${h.text}`).join("\n") : "(none)"}

MEASURED SIGNALS (computed, trust these over your impression)
- candidate spoke ${e.candidateTurns} times, ${e.candidateWords} words total (${e.wordsPerMinute.toFixed(1)} words/min)
- longest silence: ${formatClock(e.longestSilenceMs)}
- asked a clarifying question: ${session.signals.askedClarifyingQuestion}
- explained approach before coding: ${session.signals.explainedApproachBeforeCoding}
- stated a complexity out loud: ${session.signals.statedComplexity}
- passed the large/performance tests: ${e.perfTestsPassed}

FINAL CODE
\`\`\`${session.config.language}
${session.code.slice(0, 6000)}
\`\`\``;
}

export async function generateReport(session: Session): Promise<Report> {
  const baseline = buildDeterministicReport(session);
  const provider = getProvider();
  if (!provider) return baseline;

  const evidence = gatherEvidence(session);

  try {
    const response = await provider.chat({
      system: buildAssessmentPrompt(session),
      messages: [{ role: "user", content: buildEvidenceBundle(session, evidence) }],
      temperature: 0.4,
      maxTokens: 2000,
      json: true,
    });

    const parsed = extractJson<LlmReportShape>(response.text);
    if (!parsed) return baseline;

    const scorecard: ScoreLine[] =
      parsed.scorecard?.length === 7
        ? parsed.scorecard.map((line) => ({
            category: String(line.category),
            score: clamp(Number(line.score)),
            feedback: String(line.feedback ?? "").slice(0, 400),
          }))
        : baseline.scorecard;

    const overall = overallFrom(scorecard);

    const verdicts: Report["verdict"][] = [
      "strong hire",
      "hire",
      "lean hire",
      "borderline",
      "no hire",
    ];
    const verdict = verdicts.includes(parsed.verdict as Report["verdict"])
      ? (parsed.verdict as Report["verdict"])
      : verdictFrom(overall);

    const communication: CommunicationSignals = {
      thinkingAloud: clamp(Number(parsed.communication?.thinkingAloud ?? baseline.communication.thinkingAloud)),
      explanationClarity: clamp(Number(parsed.communication?.explanationClarity ?? baseline.communication.explanationClarity)),
      questionHandling: clamp(Number(parsed.communication?.questionHandling ?? baseline.communication.questionHandling)),
      conciseness: clamp(Number(parsed.communication?.conciseness ?? baseline.communication.conciseness)),
      technicalReasoning: clamp(Number(parsed.communication?.technicalReasoning ?? baseline.communication.technicalReasoning)),
    };

    const strings = (value: unknown, fallback: string[]): string[] => {
      if (!Array.isArray(value)) return fallback;
      const out = value.filter((v) => typeof v === "string" && v.trim()).map((v) => String(v).slice(0, 400));
      return out.length ? out : fallback;
    };

    return {
      ...baseline,
      generatedAt: Date.now(),
      overall,
      verdict,
      headline: parsed.headline ? String(parsed.headline).slice(0, 300) : baseline.headline,
      scorecard,
      communication,
      technical: {
        // Measured facts always win over the model's recollection of them.
        ...baseline.technical,
        statedTime: parsed.technical?.statedTime ? String(parsed.technical.statedTime) : null,
        statedSpace: parsed.technical?.statedSpace ? String(parsed.technical.statedSpace) : null,
        approachSummary: parsed.technical?.approachSummary
          ? String(parsed.technical.approachSummary).slice(0, 600)
          : baseline.technical.approachSummary,
        edgeCases: parsed.technical?.edgeCases
          ? String(parsed.technical.edgeCases).slice(0, 600)
          : baseline.technical.edgeCases,
        readability: parsed.technical?.readability
          ? String(parsed.technical.readability).slice(0, 400)
          : baseline.technical.readability,
      },
      didWell: strings(parsed.didWell, baseline.didWell),
      hurtYou: strings(parsed.hurtYou, baseline.hurtYou),
      momentToImprove:
        parsed.momentToImprove && parsed.momentToImprove.moment
          ? {
              moment: String(parsed.momentToImprove.moment).slice(0, 300),
              whatYouSaid: String(parsed.momentToImprove.whatYouSaid ?? "").slice(0, 600),
              betterExplanation: String(parsed.momentToImprove.betterExplanation ?? "").slice(0, 800),
            }
          : null,
      focusNext: strings(parsed.focusNext, baseline.focusNext),
      offline: false,
    };
  } catch (error) {
    console.error("[assessment] model call failed, using computed report:", error);
    return baseline;
  }
}
