import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  EventKind,
  HintRecord,
  RunResult,
  Session,
  SessionConfig,
  Speaker,
  TimelineEvent,
  TranscriptTurn,
} from "@/lib/types";
import { getProblem } from "@/lib/problems";

const DATA_DIR = join(process.cwd(), ".data");

/**
 * Sessions live in memory for speed and are mirrored to disk so that a
 * dev-server hot reload, or reopening a debrief later, does not lose an
 * interview. The globalThis handle is what survives Next.js module reloads.
 */
const globalStore = globalThis as unknown as {
  __interviewSessions?: Map<string, Session>;
};
const sessions: Map<string, Session> =
  globalStore.__interviewSessions ?? new Map<string, Session>();
globalStore.__interviewSessions = sessions;

async function persist(session: Session): Promise<void> {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(
      join(DATA_DIR, `${session.id}.json`),
      JSON.stringify(session, null, 2),
      "utf8",
    );
  } catch {
    // Persistence is a convenience, never a correctness requirement.
  }
}

async function loadFromDisk(id: string): Promise<Session | null> {
  try {
    const raw = await readFile(join(DATA_DIR, `${id}.json`), "utf8");
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function elapsedMs(session: Session): number {
  if (!session.startedAt) return 0;
  const end = session.endedAt ?? Date.now();
  return end - session.startedAt;
}

export function remainingMs(session: Session): number {
  const total = session.config.durationMin * 60_000;
  return Math.max(0, total - elapsedMs(session));
}

export async function createSession(config: SessionConfig): Promise<Session> {
  const problem = getProblem(config.problemId);
  if (!problem) throw new Error(`Unknown problem: ${config.problemId}`);

  const now = Date.now();
  const session: Session = {
    id: randomUUID(),
    createdAt: now,
    startedAt: now,
    endedAt: null,
    config,
    problem,
    code: problem.starter[config.language],
    codeUpdatedAt: now,
    codeHistory: [],
    runs: [],
    transcript: [],
    timeline: [],
    hints: [],
    phase: "intro",
    report: null,
    signals: {
      lastCandidateSpeechAt: null,
      lastInterviewerSpeechAt: null,
      explainedApproachBeforeCoding: false,
      askedClarifyingQuestion: false,
      statedComplexity: false,
      firstCodeAt: null,
      silentStretches: [],
      nudgesSent: 0,
    },
  };

  sessions.set(session.id, session);
  await persist(session);
  return session;
}

export async function getSession(id: string): Promise<Session | null> {
  const cached = sessions.get(id);
  if (cached) return cached;
  const fromDisk = await loadFromDisk(id);
  if (fromDisk) sessions.set(id, fromDisk);
  return fromDisk;
}

export async function saveSession(session: Session): Promise<void> {
  sessions.set(session.id, session);
  await persist(session);
}

export async function listSessions(): Promise<
  { id: string; problemTitle: string; endedAt: number | null; overall: number | null }[]
> {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const files = await readdir(DATA_DIR);
    const ids = files.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
    const loaded = await Promise.all(ids.map((id) => getSession(id)));
    return loaded
      .filter((s): s is Session => s !== null)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((s) => ({
        id: s.id,
        problemTitle: s.problem.title,
        endedAt: s.endedAt,
        overall: s.report?.overall ?? null,
      }));
  } catch {
    return [];
  }
}

// --- mutators --------------------------------------------------------------

export function addTurn(session: Session, speaker: Speaker, text: string): TranscriptTurn {
  const turn: TranscriptTurn = {
    id: randomUUID(),
    speaker,
    text,
    at: Date.now(),
    elapsed: elapsedMs(session),
  };
  session.transcript.push(turn);
  if (speaker === "candidate") session.signals.lastCandidateSpeechAt = turn.at;
  if (speaker === "interviewer") session.signals.lastInterviewerSpeechAt = turn.at;
  return turn;
}

export function addEvent(session: Session, kind: EventKind, label: string): TimelineEvent {
  const event: TimelineEvent = {
    id: randomUUID(),
    at: Date.now(),
    elapsed: elapsedMs(session),
    kind,
    label,
  };
  session.timeline.push(event);
  return event;
}

export function addHint(session: Session, level: 1 | 2 | 3 | 4, text: string): HintRecord {
  const hint: HintRecord = {
    at: Date.now(),
    elapsed: elapsedMs(session),
    level,
    text,
  };
  session.hints.push(hint);
  addEvent(session, "hint", `Received a level ${level} interviewer hint`);
  return hint;
}

export function recordRun(session: Session, run: RunResult): void {
  session.runs.push(run);
  // Keep memory bounded on a long session; the summary fields carry the history.
  if (session.runs.length > 40) session.runs.splice(0, session.runs.length - 40);
}

const CODE_SNAPSHOT_INTERVAL_MS = 20_000;

export function updateCode(session: Session, code: string): void {
  const now = Date.now();
  const meaningful = code.trim() !== session.problem.starter[session.config.language].trim();
  if (meaningful && session.signals.firstCodeAt === null) {
    session.signals.firstCodeAt = now;
  }
  session.code = code;
  session.codeUpdatedAt = now;

  const last = session.codeHistory[session.codeHistory.length - 1];
  if (!last || now - last.at > CODE_SNAPSHOT_INTERVAL_MS) {
    session.codeHistory.push({ at: now, elapsed: elapsedMs(session), code });
    if (session.codeHistory.length > 60) session.codeHistory.shift();
  }
}

/** The latest run, which is what the interviewer and the report reason about. */
export function latestRun(session: Session): RunResult | null {
  return session.runs.length ? session.runs[session.runs.length - 1] : null;
}

export function maxHintLevel(session: Session): number {
  return session.hints.reduce((max, h) => Math.max(max, h.level), 0);
}
