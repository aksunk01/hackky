# AI Technical Interviewer

> **LeetCode teaches you to solve coding problems. This teaches you to pass the interview.**

A voice-first AI technical interviewer that hears you, watches your editor as you type,
runs your code against hidden tests, challenges your reasoning in real time, and then
tells you exactly where your interview broke down.

The point is not another LeetCode clone. The point is the part of interviewing that is
almost impossible to practise alone: **thinking out loud, defending your choices,
answering follow-ups, and debugging while somebody watches.**

---

## Quick start

```bash
npm install          # also copies the Monaco editor into public/
npm run doctor       # tells you what will and will not work on this machine
npm run dev          # http://localhost:3000
```

**It works with zero API keys.** With no configuration at all you get a complete
interview: a rule-based interviewer that asks real questions and escalates hints,
the browser's own speech recognition and speech synthesis for voice, and real code
execution against your local Node / Python / JDK toolchains.

Adding keys upgrades each layer independently:

```bash
cp .env.example .env.local
```

| Key | What it upgrades | Without it |
|---|---|---|
| `GEMINI_API_KEY` | The interviewer becomes an adaptive tool-using agent | Built-in rule-based interviewer |
| `ANTHROPIC_API_KEY` | Same, via Claude instead | — |
| `ELEVENLABS_API_KEY` | Natural interviewer voice | Browser speech synthesis |

Gemini is the default when both model keys are present; `LLM_PROVIDER` overrides it.

> Use **Chrome or Edge**. Speech recognition is a Chromium-only browser API. Typing to
> the interviewer works in every browser, and the interview is fully playable that way.

---

## What is actually built

Everything in the MVP list, working end to end:

- Voice conversation with the interviewer (speech in, speech out)
- Monaco editor with Java, Python and JavaScript
- 16 curated problems covering all ten planned categories
- Run Code against visible **and hidden** tests, executed for real
- The interviewer can read your editor and run your tests itself
- Adaptive questioning and a rationed 4-level hint ladder
- Interview timer, live transcript, and an annotated timeline
- A final scorecard and a written debrief

---

## The part that makes it an interview

A normal assistant races you to the answer. This one is built to withhold it.

**The interviewer can see what you are doing.** It has tools, and it uses them:

```
read_editor_code()      get_problem()          get_interview_state()
run_tests()             get_test_results()     give_hint(level)
note_moment(kind,...)   set_phase(phase)       end_interview(reason)
```

So when you write a nested loop on a problem that wants linear time, it does not wait
for you to finish — it asks what the runtime of what you have written is.

**Hints are rationed and scored.** Every problem ships an authored 4-rung ladder, from
a guiding question that reveals nothing up to major assistance. `give_hint` is
**clamped server-side to at most one level above what has already been given**, so the
model cannot skip to the answer even if it decides to. Hint depth feeds your score.

**Hidden tests stay hidden.** During the interview, hidden test inputs and expected
values are stripped server-side before the session is ever sent to the browser — along
with the optimal approach, the pitfall list and the hint ladder. They are revealed in
your debrief. (There is an automated test asserting none of it leaks into the HTML.)

**The assessment is grounded in evidence, not vibes.** Measured signals — words per
minute, longest silence, whether you stated a complexity unprompted, whether the
performance tests passed, how many hints you took — are computed deterministically and
given to the model as facts it is told to trust over its own impression. Those measured
facts then **overwrite** the model's version in the final report. If the model is
unavailable or returns something unparseable, the computed report stands on its own.

---

## Architecture

```
Next.js 15 (App Router) ── React 19 ── Tailwind v4
        │
        ├── Monaco editor (self-hosted, no CDN)
        ├── Web Speech API ──── speech → text
        └── ElevenLabs / speechSynthesis ──── text → speech
                    │
                    ▼
          Interviewer agent  ── 9 tools, max 5 tool rounds
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   Gemini / Claude      rule-based fallback
                    │
                    ▼
          Local code runner ── node · python3 · javac+java
```

### Code execution

Runs **locally against real toolchains** rather than a remote judge, which keeps the
demo working without an account or network. For each run the server writes a generated
harness to a fresh temp directory, executes it with a bare environment (no API keys
inherited), enforces a wall-clock timeout, caps output, and deletes the directory.

Per-language harnesses handle argument construction and result serialisation so all
three languages produce **identical JSON**, which a single comparison layer then checks.
Results are appended synchronously to a file so that a `SIGKILL` on timeout still
preserves the tests that did finish — that is why a timeout reports "7 passed, 3 timed
out" instead of losing the whole run.

Notable detail: Java test data is written to a side file rather than inlined as source
literals. A 20,000-element array literal exceeds the JVM's 64KB per-method bytecode
limit and fails to compile with `code too large`.

### Layout

```
src/
├── app/
│   ├── page.tsx                 configure the interview
│   ├── interview/[id]/          the interview room
│   ├── report/[id]/             the debrief
│   └── api/                     session · code · run · turn · end · tts · health
├── components/                  editor, problem, transcript, results, scorecard
├── hooks/                       speech recognition, interviewer voice
└── lib/
    ├── problems/                the 16-problem bank
    ├── runner/                  harness generation, execution, comparison
    ├── agent/                   prompts, tools, agent loop, offline, assessment
    ├── llm/                     provider abstraction + Gemini + Anthropic
    └── store.ts                 session state
```

---

## Problem bank

16 problems — 5 easy, 9 medium, 2 hard — covering arrays, hash maps, two pointers,
sliding window, linked lists, trees, graphs, stacks/queues, binary search and dynamic
programming.

Each problem carries more than a description. It also ships the interviewer's private
briefing: the optimal approach and its complexity, the brute force most candidates open
with, the specific mistakes worth probing, good follow-up questions, the clarifying
questions a strong candidate asks unprompted, and the 4-rung hint ladder. That briefing
is what lets even the key-less rule-based interviewer ask something worth answering.

Hidden tests are chosen adversarially, not for coverage theatre — `abba` for the sliding
window that must not walk backwards, `[[1,4],[2,3]]` for the interval merge that forgets
`max`, `[1,3,4]` with amount 6 for the greedy coin-change that looks right, and large
inputs sized to reject an `O(n²)` solution that passes every small example.

**Every problem is verified against reference solutions in all three languages** —
16 problems × 3 languages, all 137 test cases each. Two of my own expected values were
wrong when I first wrote them; that check is how I found out.

---

## Testing

The validation harnesses live in the scratchpad rather than the repo, but the checks
they ran are worth knowing about:

- **Problem bank:** all 16 problems × 3 languages, every test case, against reference
  solutions. All green.
- **Runner failure paths:** wrong answers fail, infinite loops time out, compile errors
  are reported, runtime exceptions are attributed to the right test, `print`/`console.log`
  output is captured per test, and a missing function produces a useful message rather
  than a crash.
- **End to end over HTTP:** create a session, the interviewer opens, the candidate speaks,
  hints escalate 1 → 2 (and refuse to skip), a wrong solution fails, a correct one passes,
  the interview ends and produces a report; writes are refused after the interview ends.
- **Model path with a mocked provider:** tool calls parsed and executed, tool results fed
  back in the right shape for both Gemini and Anthropic, hint level clamped from a
  requested 4 down to 1, markdown stripped from spoken replies, `[SILENT]` honoured, and
  a provider outage degrading to the offline interviewer instead of ending the interview.
- **Leak checks:** hidden test data, hint ladders and optimal approaches are asserted
  absent from the interview room HTML.

---

## Known limitations

- **Speech recognition is Chromium-only.** Firefox and Safari users must type. The UI
  says so rather than appearing broken.
- **Candidate code runs on the host machine**, sandboxed only by a temp directory, a
  stripped environment, a timeout and an output cap. That is fine for a local practice
  tool where you are running your own code. Putting this on the public internet needs a
  real sandbox first — Judge0, Piston, or a container per run. `src/lib/runner/index.ts`
  is the single seam where that would slot in.
- **Sessions are stored on local disk** (`.data/`), not a database. Fine for a hackathon,
  not multi-user.
- `npm audit` reports advisories in `postcss` (transitively inside Next) and `dompurify`
  (inside `monaco-editor`). Both are build-time/editor-internal and only clear via a
  breaking upgrade to Next 16, which was not worth the instability mid-build.

---

## Not built (deliberately)

Auth, leaderboards, payments, resume analysis, job matching, behavioural/STAR mode, and
company-style interviews are all out of scope, as planned. The interview-history loop
(carrying weaknesses from one interview into the next) is **half built**: `SessionConfig`
accepts `focusAreas`, and the system prompt uses them to open the next interview on your
last debrief's weak point. Nothing populates it from a previous report yet — that is the
shortest path to the "AI interview coach" story.
