// ---------------------------------------------------------------------------
// Core domain types for the AI Technical Interviewer.
// ---------------------------------------------------------------------------

export const LANGUAGES = ["java", "python", "javascript"] as const;
export type Language = (typeof LANGUAGES)[number];

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const STYLES = [
  "general",
  "fast-paced",
  "reasoning-focused",
  "collaborative",
] as const;
export type InterviewStyle = (typeof STYLES)[number];

export const CATEGORIES = [
  "Arrays",
  "Hash Maps",
  "Two Pointers",
  "Sliding Window",
  "Linked Lists",
  "Trees",
  "Graphs",
  "Stacks / Queues",
  "Binary Search",
  "Dynamic Programming",
] as const;
export type Category = (typeof CATEGORIES)[number];

// --- Problem bank ----------------------------------------------------------

/**
 * The value types a problem signature may use. Kept deliberately small so the
 * per-language test harnesses can build and serialise every one of them.
 */
export type ValueType =
  | "int"
  | "boolean"
  | "string"
  | "int[]"
  | "int[][]"
  | "string[]"
  | "char[][]"
  | "ListNode"
  | "TreeNode"
  | "int[][]?" // list-of-lists return, order of the outer list is not fixed
  | "string[][]";

export interface Example {
  input: string;
  output: string;
  explanation?: string;
}

export interface TestCase {
  /** Positional arguments, as JSON values, matching `paramTypes`. */
  args: unknown[];
  expected: unknown;
  /** Hidden tests are run but never shown to the candidate before the debrief. */
  hidden?: boolean;
  /** Short human label used in the results table and the interviewer's context. */
  label?: string;
}

/**
 * How a produced value is compared with the expected value.
 * - exact:          deep equality, order matters
 * - sortedArray:    a flat array compared as a multiset (e.g. a pair of indices)
 * - setOfSets:      an array of arrays, both levels compared as multisets
 * - outerUnordered: an array of arrays, outer is a multiset, inner stays ordered
 */
export type CompareMode =
  | "exact"
  | "sortedArray"
  | "setOfSets"
  | "outerUnordered";

export interface HintLadder {
  /** Level 1 — a guiding question that reveals nothing. */
  l1: string;
  /** Level 2 — point at the underlying concept. */
  l2: string;
  /** Level 3 — name the data structure or strategy. */
  l3: string;
  /** Level 4 — major assistance, close to the approach itself. */
  l4: string;
}

export interface InterviewerNotes {
  /** What a strong candidate lands on. */
  optimal: string;
  optimalTime: string;
  optimalSpace: string;
  /** The naive approach most candidates open with. */
  bruteForce: string;
  bruteForceTime: string;
  /** Mistakes worth probing when the interviewer sees them. */
  pitfalls: string[];
  /** Questions a good interviewer asks once the candidate is on track. */
  followUps: string[];
  /** Clarifying questions a strong candidate should ask unprompted. */
  clarifications: string[];
  hints: HintLadder;
}

export interface Problem {
  id: string;
  title: string;
  difficulty: Difficulty;
  category: Category;
  /** Paragraphs of prose. Inline `backticks` are rendered as code. */
  description: string[];
  examples: Example[];
  constraints: string[];
  functionName: string;
  paramNames: string[];
  paramTypes: ValueType[];
  returnType: ValueType;
  compare: CompareMode;
  starter: Record<Language, string>;
  tests: TestCase[];
  notes: InterviewerNotes;
}

// --- Code execution --------------------------------------------------------

export interface TestResult {
  index: number;
  label: string;
  hidden: boolean;
  passed: boolean;
  input: string;
  expected: string;
  actual: string;
  stdout: string;
  error: string | null;
  timedOut: boolean;
  ms: number;
}

export interface RunResult {
  id: string;
  at: number;
  language: Language;
  /** Who pressed run — the candidate, or the interviewer reaching for the tool. */
  trigger: "candidate" | "interviewer";
  compiled: boolean;
  compileError: string | null;
  results: TestResult[];
  passed: number;
  total: number;
  visiblePassed: number;
  visibleTotal: number;
  totalMs: number;
}

// --- Interview session -----------------------------------------------------

export type Speaker = "interviewer" | "candidate" | "system";

export interface TranscriptTurn {
  id: string;
  speaker: Speaker;
  text: string;
  at: number;
  /** Elapsed ms into the interview, for the transcript gutter. */
  elapsed: number;
}

export type EventKind = "good" | "warn" | "bad" | "hint" | "info";

export interface TimelineEvent {
  id: string;
  at: number;
  elapsed: number;
  kind: EventKind;
  label: string;
}

export type Phase =
  | "intro"
  | "approach"
  | "coding"
  | "debugging"
  | "wrapup"
  | "ended";

export interface HintRecord {
  at: number;
  elapsed: number;
  level: 1 | 2 | 3 | 4;
  text: string;
}

export interface SessionConfig {
  language: Language;
  difficulty: Difficulty;
  style: InterviewStyle;
  problemId: string;
  durationMin: number;
  /** Carried forward from a previous debrief, to make the interviewer a coach. */
  focusAreas?: string[];
}

export interface Session {
  id: string;
  createdAt: number;
  startedAt: number | null;
  endedAt: number | null;
  config: SessionConfig;
  problem: Problem;
  code: string;
  codeUpdatedAt: number;
  /** Snapshots of the editor, so the debrief can describe how the code evolved. */
  codeHistory: { at: number; elapsed: number; code: string }[];
  runs: RunResult[];
  transcript: TranscriptTurn[];
  timeline: TimelineEvent[];
  hints: HintRecord[];
  phase: Phase;
  report: Report | null;
  /** Bookkeeping the interviewer uses to decide when to speak up. */
  signals: {
    lastCandidateSpeechAt: number | null;
    lastInterviewerSpeechAt: number | null;
    explainedApproachBeforeCoding: boolean;
    askedClarifyingQuestion: boolean;
    statedComplexity: boolean;
    firstCodeAt: number | null;
    silentStretches: { start: number; ms: number }[];
    nudgesSent: number;
  };
}

// --- Assessment ------------------------------------------------------------

export interface ScoreLine {
  category: string;
  score: number; // 0-10
  feedback: string;
}

export interface CommunicationSignals {
  thinkingAloud: number;
  explanationClarity: number;
  questionHandling: number;
  conciseness: number;
  technicalReasoning: number;
}

export interface Report {
  generatedAt: number;
  /** 0-100, weighted across the scorecard. */
  overall: number;
  verdict: "strong hire" | "hire" | "lean hire" | "borderline" | "no hire";
  headline: string;
  scorecard: ScoreLine[];
  communication: CommunicationSignals;
  technical: {
    compiles: boolean;
    testsPassed: number;
    testsTotal: number;
    hiddenPassed: number;
    hiddenTotal: number;
    statedTime: string | null;
    statedSpace: string | null;
    optimalTime: string;
    optimalSpace: string;
    approachSummary: string;
    edgeCases: string;
    readability: string;
  };
  hintsUsed: { count: number; maxLevel: number; summary: string };
  didWell: string[];
  hurtYou: string[];
  momentToImprove: { moment: string; whatYouSaid: string; betterExplanation: string } | null;
  focusNext: string[];
  /** True when the report came from the rule-based generator, not an LLM. */
  offline: boolean;
}

// --- Agent -----------------------------------------------------------------

export type TurnTrigger =
  | { kind: "start" }
  | { kind: "candidate"; text: string }
  | { kind: "tests_ran"; runId: string }
  | { kind: "silence"; seconds: number }
  | { kind: "code_change" }
  | { kind: "time_warning"; minutesLeft: number }
  | { kind: "request_hint" };

export interface AgentReply {
  /** null means the interviewer deliberately stayed quiet. */
  speak: string | null;
  toolsUsed: string[];
  hintLevel: number | null;
  events: { kind: EventKind; label: string }[];
  phase: Phase | null;
  offline: boolean;
}
