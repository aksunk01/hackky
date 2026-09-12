// Copies the Monaco editor assets into public/ so the editor is served from
// this app rather than a CDN. That keeps the interview room working on a
// flaky network, and pins the editor to the version in package-lock.json.
import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "monaco-editor", "min", "vs");
const target = join(root, "public", "monaco", "vs");

try {
  await stat(source);
} catch {
  console.warn("[monaco] node_modules/monaco-editor not found — skipping asset copy.");
  process.exit(0);
}

await rm(target, { recursive: true, force: true });
await mkdir(dirname(target), { recursive: true });
await cp(source, target, { recursive: true });
console.log("[monaco] editor assets copied to public/monaco/vs");
