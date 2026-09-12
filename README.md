# InterviewAI

AI-powered technical interview practice: pick a coding problem, talk through your approach with an AI interviewer, write and run Python code, and get a scored evaluation.

## Setup

```bash
npm install
cp env.local.example .env.local
```

Add a [Gemini API key](https://aistudio.google.com/apikey) to `.env.local`:

```
GEMINI_API_KEY=your-key-here
```

Without a key, the app still runs in **demo mode** — the interviewer and evaluator fall back to scripted responses so the flow works end-to-end offline. The chat header says `scripted` whenever that's happening, so a canned reply is never mistaken for the model ignoring your code.

The model defaults to `gemini-3.5-flash`; set `GEMINI_MODEL` to override. Don't use `gemini-3.6-flash` on a free key — its quota is 20 requests and it 429s almost immediately, which lands you in demo mode.

For voice (the interviewer speaking, and speech-to-text for your answers), also add an [ElevenLabs API key](https://elevenlabs.io/app/settings/api-keys):

```
ELEVENLABS_API_KEY=your-key-here
```

Without it, the speech endpoints return 503 and the app falls back to the browser's built-in speech recognition. `GET /api/speech-health` reports whether the key is configured and which voice/models are in use.

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click **Start Interview**, pick a problem, and go.

## How it works

- **Frontend**: Next.js App Router pages for landing, problem selection, the interview workspace (Monaco editor + chat), and results.
- **Interviewer**: `/api/interview` calls Gemini with the problem, conversation history, the current editor contents, and the most recent test run to produce the next interviewer message. It also answers two editor-driven events — `run` (the candidate just ran the tests) and `code-review` (they typed and went quiet for 12s) — so Alex comments on code without being asked. Unintelligible or off-topic input is deflected to a fixed complexity question instead of spending a model call on noise.
- **Code execution**: `/api/execute` runs submitted Python against the problem's test cases via a subprocess with a harness (not a fully isolated sandbox — fine for local demo use, not for untrusted multi-tenant deployment).
- **Voice**: `/api/stream-speech` streams ElevenLabs TTS audio back to the browser; `/api/transcribe-audio` posts recorded mic audio to ElevenLabs Scribe. Both are ordinary Next route handlers served from the same origin as the app, so `npm run dev` is the only process you need. The mic is held closed while the interviewer speaks, so it can't transcribe its own voice back into the conversation. Both engines show a live transcript as you talk — the browser engine revises its guess continuously, while Scribe periodically re-transcribes the in-progress recording — and the finished utterance replaces it once you stop.
- **Evaluation**: `/api/evaluate` re-runs the tests and asks Gemini to score the transcript + code across problem solving, communication, correctness, code quality, complexity analysis, and debugging.

## Security note

Never commit `.env.local` or API keys. If you're pulling in code from other branches in this repo, double-check for hardcoded secrets before merging.
