import type { AgentReply, EventKind, Session, TurnTrigger } from "@/lib/types";
import { addHint, latestRun, maxHintLevel } from "@/lib/store";

/**
 * A rule-based interviewer used whenever no model provider is configured.
 * It is driven by each problem's authored hint ladder, follow-ups and pitfalls,
 * so a key-less demo still behaves like an interview rather than a placeholder.
 */

const COMPLEXITY_RE = /\bO\s*\(\s*[^)]{1,24}\)/i;

const STUCK_RE =
  /\b(stuck|no idea|not sure|give me a hint|a hint|help me|i'm lost|im lost|don't know|dont know|can you help|what should i|i give up)\b/i;

const BRUTE_RE = /\b(brute[ -]?force|naive|nested loop|two loops|check every|try all|every pair)\b/i;

const APPROACH_RE =
  /\b(approach|plan|idea|i would|i'd|first i|my thinking|start by|iterate|traverse|loop through)\b/i;

/** Concept keywords that signal the candidate is nearing the intended solution. */
const CONCEPTS: { re: RegExp; label: string; probe: string }[] = [
  { re: /\bhash\s?map|hashmap|dictionary|hash table|a map\b/i, label: "a hash map", probe: "What would you use as the key, and what would the value be?" },
  { re: /\btwo pointer|both ends|left and right pointer\b/i, label: "two pointers", probe: "How do you decide which pointer to move at each step?" },
  { re: /\bsliding window|window\b/i, label: "a sliding window", probe: "What makes you shrink the window, and what makes you grow it?" },
  { re: /\bstack\b/i, label: "a stack", probe: "What are you pushing onto it, and when do you pop?" },
  { re: /\bqueue|bfs|breadth[ -]?first\b/i, label: "a queue", probe: "How do you know where one level ends and the next begins?" },
  { re: /\bdfs|depth[ -]?first|recursion|recursive\b/i, label: "recursion", probe: "What is your base case, and how deep can that recursion go?" },
  { re: /\bbinary search|halve|divide in half\b/i, label: "binary search", probe: "What invariant lets you throw away half the array each time?" },
  { re: /\bdynamic programming|\bdp\b|memoi[sz]|subproblem\b/i, label: "dynamic programming", probe: "What exactly does each entry of your table mean?" },
  { re: /\bsort(ed|ing)?\b/i, label: "sorting", probe: "What does sorting buy you here, and what does it cost?" },
  { re: /\btopological|in[- ]?degree|cycle detect\b/i, label: "a topological ordering", probe: "What does a cycle mean in terms of the original question?" },
  { re: /\bprefix|suffix|running product|running sum\b/i, label: "prefix and suffix products", probe: "How many passes does that take, and what do you keep between them?" },
];

const SILENCE_NUDGES = [
  "What are you thinking right now?",
  "Talk me through what you are writing.",
  "You have gone quiet — where are you in your head?",
  "Say what you are weighing up, even if you have not decided yet.",
];

const GENERIC_PROBES = [
  "Why that approach over the alternative?",
  "What is the runtime of what you have described?",
  "What happens on the smallest possible input?",
  "Is there an input that would break that?",
];

function alreadySaid(session: Session, text: string): boolean {
  const needle = text.slice(0, 40).toLowerCase();
  return session.transcript
    .filter((t) => t.speaker === "interviewer")
    .some((t) => t.text.toLowerCase().includes(needle));
}

/** Picks the first option the interviewer has not already used. */
function pickFresh(session: Session, options: string[], fallback: string): string {
  for (const option of options) {
    if (!alreadySaid(session, option)) return option;
  }
  return fallback;
}

function reply(
  speak: string | null,
  extras: Partial<AgentReply> = {},
): AgentReply {
  return {
    speak,
    toolsUsed: extras.toolsUsed ?? [],
    hintLevel: extras.hintLevel ?? null,
    events: extras.events ?? [],
    phase: extras.phase ?? null,
    offline: true,
  };
}

function nextHint(session: Session): AgentReply {
  const level = Math.min(4, maxHintLevel(session) + 1) as 1 | 2 | 3 | 4;
  const ladder = session.problem.notes.hints;
  const text = [ladder.l1, ladder.l2, ladder.l3, ladder.l4][level - 1];
  addHint(session, level, text);
  return reply(text, { hintLevel: level, toolsUsed: ["give_hint"] });
}

/**
 * A deliberately rough check for one loop closely following another. Brace or
 * indentation tracking is not portable across Java, Python and JavaScript, and
 * this only decides whether to ask "what is the runtime of that?" — a question
 * that costs nothing if the guess is wrong.
 */
function hasNestedLoop(code: string): boolean {
  return /\b(for|while)\b[\s\S]{0,200}?\b(for|while)\b/.test(code);
}

export function offlineReply(session: Session, trigger: TurnTrigger): AgentReply {
  const problem = session.problem;
  const notes = problem.notes;
  const events: { kind: EventKind; label: string }[] = [];

  switch (trigger.kind) {
    case "start":
      return reply(
        `Thanks for joining. Today we are looking at ${problem.title}. Before you write any code, walk me through how you are thinking about it.`,
        { phase: "approach", events: [{ kind: "info", label: "Interview started" }] },
      );

    case "request_hint":
      return nextHint(session);

    case "silence": {
      if (trigger.seconds >= 75) {
        events.push({ kind: "warn", label: "Stopped explaining reasoning while coding" });
      }
      return reply(pickFresh(session, SILENCE_NUDGES, SILENCE_NUDGES[0]), { events });
    }

    case "time_warning":
      return reply(
        `We have about ${trigger.minutesLeft} minute${trigger.minutesLeft === 1 ? "" : "s"} left. Where are you?`,
        { phase: "wrapup", events: [{ kind: "info", label: `${trigger.minutesLeft} minutes remaining` }] },
      );

    case "code_change": {
      // Only speak up for something genuinely worth probing, and only once.
      const optimalIsSubQuadratic = !/n\^2|n²/i.test(notes.optimalTime);
      const probe = "What is the runtime of the solution you have written so far?";
      if (optimalIsSubQuadratic && hasNestedLoop(session.code) && !alreadySaid(session, probe)) {
        return reply(probe, { phase: "coding" });
      }
      return reply(null);
    }

    case "tests_ran": {
      const run = latestRun(session);
      if (!run) return reply(null);

      if (run.compileError) {
        return reply(
          "That did not compile. Read the error and tell me what it is objecting to.",
          { phase: "debugging", events: [{ kind: "bad", label: "Code failed to compile" }] },
        );
      }

      if (run.passed === run.total) {
        if (!session.signals.statedComplexity) {
          return reply(
            "Everything passes. Now tell me the time and space complexity of what you wrote, and why.",
            {
              phase: "wrapup",
              events: [{ kind: "good", label: `All ${run.total} tests passing` }],
            },
          );
        }
        const followUp = pickFresh(session, notes.followUps, notes.followUps[0]);
        return reply(followUp, {
          phase: "wrapup",
          events: [{ kind: "good", label: `All ${run.total} tests passing` }],
        });
      }

      const failing = run.results.filter((r) => !r.passed);
      const visibleFail = failing.find((r) => !r.hidden);
      const timedOut = failing.some((r) => r.timedOut);

      if (timedOut) {
        return reply(
          "Something is timing out on the larger input. What is the complexity of your loop, and does it match what this problem needs?",
          { phase: "debugging", events: [{ kind: "bad", label: "Solution timed out on a large input" }] },
        );
      }
      if (visibleFail) {
        return reply(
          `You are at ${run.passed} of ${run.total}. Look at the case where ${visibleFail.input}. What assumption is your code making there?`,
          { phase: "debugging", events: [{ kind: "warn", label: `Failing tests: ${run.total - run.passed}` }] },
        );
      }
      return reply(
        `The visible cases pass but a hidden one does not. Think about the edges — ${notes.clarifications[0]?.toLowerCase().replace(/\?$/, "") ?? "the smallest input"}.`,
        { phase: "debugging", events: [{ kind: "warn", label: "Hidden test failing" }] },
      );
    }

    case "candidate": {
      const text = trigger.text;

      if (STUCK_RE.test(text)) return nextHint(session);

      if (COMPLEXITY_RE.test(text)) {
        session.signals.statedComplexity = true;
        const probe = "Walk me through how you got to that. Which part of the code dominates?";
        if (!alreadySaid(session, probe)) {
          return reply(probe, {
            events: [{ kind: "good", label: `Stated complexity: ${text.match(COMPLEXITY_RE)?.[0] ?? ""}` }],
          });
        }
        return reply(pickFresh(session, notes.followUps, GENERIC_PROBES[0]), {
          events: [{ kind: "good", label: "Discussed complexity" }],
        });
      }

      if (text.trim().endsWith("?")) {
        session.signals.askedClarifyingQuestion = true;
        return reply(
          `Good question to ask. Work from the constraints as written: ${problem.constraints[0]}. Does that change your approach?`,
          { events: [{ kind: "good", label: "Asked a clarifying question" }] },
        );
      }

      const concept = CONCEPTS.find((c) => c.re.test(text));
      if (concept && !alreadySaid(session, concept.probe)) {
        const onTrack = notes.optimal.toLowerCase().includes(concept.label.replace(/^an? /, ""));
        return reply(concept.probe, {
          phase: "coding",
          events: [
            {
              kind: onTrack ? "good" : "info",
              label: `Proposed ${concept.label}`,
            },
          ],
        });
      }

      if (BRUTE_RE.test(text)) {
        const probe = `That would work. What is its runtime, and which part of it is the expensive bit?`;
        if (!alreadySaid(session, probe)) {
          return reply(probe, {
            phase: "approach",
            events: [{ kind: "good", label: "Described the brute-force solution" }],
          });
        }
      }

      if (APPROACH_RE.test(text) && !session.signals.explainedApproachBeforeCoding) {
        session.signals.explainedApproachBeforeCoding = true;
        events.push({ kind: "good", label: "Explained approach before coding" });
      }

      // Nothing specific matched: keep the interview moving with a real question.
      const probe = pickFresh(
        session,
        [...notes.clarifications.map((c) => `Before you go further — ${c.toLowerCase()}`), ...GENERIC_PROBES],
        GENERIC_PROBES[1],
      );
      return reply(probe, { events });
    }
  }
}
