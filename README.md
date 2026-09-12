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

Without a key, the app still runs in **demo mode** — the interviewer and evaluator fall back to scripted responses so the flow works end-to-end offline.

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click **Start Interview**, pick a problem, and go.

## How it works

- **Frontend**: Next.js App Router pages for landing, problem selection, the interview workspace (Monaco editor + chat), and results.
- **Interviewer**: `/api/interview` calls Gemini with the problem, conversation history, and current code to produce the next interviewer message.
- **Code execution**: `/api/execute` runs submitted Python against the problem's test cases via a subprocess with a harness (not a fully isolated sandbox — fine for local demo use, not for untrusted multi-tenant deployment).
- **Evaluation**: `/api/evaluate` re-runs the tests and asks Gemini to score the transcript + code across problem solving, communication, correctness, code quality, complexity analysis, and debugging.

## Security note

Never commit `.env.local` or API keys. If you're pulling in code from other branches in this repo, double-check for hardcoded secrets before merging.
