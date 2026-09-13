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

Without a Gemini key, the interviewer and evaluator use **demo-mode** responses. Claude is available as an alternative interviewer/evaluator, selectable per-interview from the problem picker — see `ANTHROPIC_API_KEY`/`CLAUDE_MODEL` below. Firestore is still required to save completed reports. The chat header says `scripted` whenever demo-mode is happening, so a canned reply is never mistaken for the model ignoring your code.

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

Open [http://localhost:3000](http://localhost:3000). Every page except the landing page and **About** requires an account — you'll be redirected to **Log in** first.

## Login (Firebase Auth)

Accounts are email/password or Google sign-in via Firebase Auth. A signed server session cookie (not the raw Firebase ID token) is what actually gates access — see `src/middleware.ts`, `/api/auth/session`, and `src/lib/auth.ts`.

1. In the Firebase console, go to **Build -> Authentication -> Sign-in method** and enable **Email/Password** and **Google**.
2. In **Project settings -> General -> "Your apps"**, add a web app and copy its `firebaseConfig` values into `.env.local` (these are public/client-side values, not secrets):

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

Signing in for the first time creates a profile document in the `users` Firestore collection (email, display name, photo URL, `createdAt`/`lastLoginAt`) — see `src/lib/users.ts`.

## Saved interview reports (Cloud Firestore)

Completed reports are stored in [Cloud Firestore](https://console.firebase.google.com) so signing in from anywhere shows the same **History**.

1. Create a Firebase project and enable **Firestore Database** (Standard Edition — it carries the free tier; production-mode security rules are fine since the app only ever talks to Firestore from the server).
2. In **Project settings -> Service accounts**, generate a new private key (downloads a JSON file).
3. Fill in `.env.local` from that file's `project_id`, `client_email`, and `private_key` fields:

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

`FIREBASE_PRIVATE_KEY` must stay on one line with its `\n` sequences escaped, exactly as the JSON file has it. The report pages read directly from Firestore; if the connection is unavailable, the app shows a retryable error instead of claiming a report was saved. Sessions are scoped to your account (`uid`), so they follow you across browsers and devices.

## How it works

- **Frontend**: Next.js App Router pages for landing, problem selection, the interview workspace (Monaco editor + chat), and results.
- **Interviewer**: `/api/interview` calls Gemini with the problem, conversation history, the current editor contents, and the most recent test run to produce the next interviewer message. It also answers two editor-driven events — `run` (the candidate just ran the tests) and `code-review` (they typed and went quiet for 12s) — so Alex comments on code without being asked. Unintelligible or off-topic input is deflected to a fixed complexity question instead of spending a model call on noise.
- **Code execution**: `/api/execute` runs submitted Python against the problem's test cases via a subprocess with a harness (not a fully isolated sandbox — fine for local demo use, not for untrusted multi-tenant deployment).
- **Voice**: `/api/stream-speech` streams ElevenLabs TTS audio back to the browser (`GET`, so `<audio>` can point straight at it and start playing as bytes arrive — `POST` is a buffered fallback for the rare reply too long to fit a URL); `/api/transcribe-audio` posts recorded mic audio to ElevenLabs Scribe. All are ordinary Next route handlers served from the same origin as the app, so `npm run dev` is the only process you need. The mic is held closed for the interviewer's entire turn — from the moment a reply is requested through the end of TTS playback, not just while audio is actually coming out of the speakers — so it can't transcribe its own voice, or be talked over during model/synthesis latency, back into the conversation. Both listening engines show a live transcript as you talk — the browser engine revises its guess continuously, while Scribe periodically re-transcribes the in-progress recording — and the finished utterance replaces it once you stop.
- **Evaluation**: `/api/evaluate` re-runs the tests and asks Gemini or Claude to score the transcript + code across problem solving, communication, correctness, code quality, complexity analysis, and debugging.
- **Login**: `/login` handles email/password and Google sign-in via the Firebase client SDK, then exchanges the ID token for a server-verified session cookie at `/api/auth/session`. `src/middleware.ts` redirects signed-out visitors away from `/problems`, `/interview`, and `/sessions`.
- **History**: Submit saves the final code, transcript, test count, and grading to Firestore keyed by the signed-in account's `uid`, then opens `/sessions/[id]`. `/sessions` lists that account's completed reports from any device.

## Security note

Never commit `.env.local` or API keys. If you're pulling in code from other branches in this repo, double-check for hardcoded secrets before merging.
