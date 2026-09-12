// Pre-flight check: tells you exactly what will and will not work before you
// start an interview. Run with `npm run doctor`.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const ok = (m, d) => console.log(`${GREEN}  ok  ${RESET}${m}${d ? `${DIM} — ${d}${RESET}` : ""}`);
const warn = (m, d) => console.log(`${YELLOW} warn ${RESET}${m}${d ? `${DIM} — ${d}${RESET}` : ""}`);
const bad = (m, d) => console.log(`${RED} fail ${RESET}${m}${d ? `${DIM} — ${d}${RESET}` : ""}`);

function run(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("error", () => resolve({ code: 1, out: "" }));
    child.on("close", (code) => resolve({ code, out: out.trim().split("\n")[0] }));
  });
}

// .env.local is read manually — this script runs outside the Next.js runtime.
const envPath = join(root, ".env.local");
const env = { ...process.env };
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

console.log("\nAI Technical Interviewer — pre-flight\n");

console.log("Code execution");
const checks = [
  ["JavaScript", "node", ["--version"]],
  ["Python", "python3", ["--version"]],
  ["Java (compiler)", "javac", ["-version"]],
  ["Java (runtime)", "java", ["-version"]],
];
let anyRuntime = false;
for (const [label, cmd, args] of checks) {
  const result = await run(cmd, args);
  if (result.code === 0) {
    ok(label, result.out);
    anyRuntime = true;
  } else {
    bad(label, `\`${cmd}\` not found — that language's Run Code will fail`);
  }
}

console.log("\nInterviewer");
const forced = (env.LLM_PROVIDER ?? "").trim().toLowerCase();
if (forced === "none") {
  warn("Offline mode forced", "LLM_PROVIDER=none — the rule-based interviewer will be used");
} else if (env.GEMINI_API_KEY && forced !== "anthropic") {
  ok("Gemini", env.GEMINI_MODEL || "gemini-2.5-flash");
} else if (env.ANTHROPIC_API_KEY) {
  ok("Anthropic", env.ANTHROPIC_MODEL || "claude-sonnet-5");
} else {
  warn(
    "No model API key",
    "falling back to the built-in rule-based interviewer; set GEMINI_API_KEY in .env.local for the full experience",
  );
}

console.log("\nVoice");
if (env.ELEVENLABS_API_KEY) ok("Text to speech", "ElevenLabs");
else warn("Text to speech", "no ELEVENLABS_API_KEY — the browser's built-in voice will be used");
ok("Speech to text", "Web Speech API in the browser (Chrome or Edge)");

console.log("\nAssets");
if (existsSync(join(root, "public", "monaco", "vs", "loader.js"))) {
  ok("Monaco editor", "self-hosted from public/monaco");
} else {
  bad("Monaco editor", "run `npm run setup:monaco` to copy the editor assets");
}

console.log(
  `\n${anyRuntime ? "Ready. Start with `npm run dev`." : "No language runtimes found — install Node, Python or a JDK first."}\n`,
);
