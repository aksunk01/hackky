// Uploads every problem in scripts/new-problems.mjs into the Firestore
// `problems` collection. Re-runnable: an existing `id` is overwritten in
// place (keeping its original list position) rather than duplicated; a new
// `id` is appended after every problem currently in the collection.
//
// Usage: node --env-file=.env scripts/add-problems.mjs

import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { newProblems } from "./new-problems.mjs";

const COLLECTION = "problems";
const REQUIRED_FIELDS = [
  "id",
  "title",
  "difficulty",
  "tags",
  "description",
  "examples",
  "constraints",
  "funcName",
  "starterCode",
  "testCases",
];
const TYPED_LANGUAGES = ["c", "cpp", "java", "csharp"];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function validate(problem, index) {
  const label = problem?.id ? `"${problem.id}"` : `entry ${index}`;
  const missing = REQUIRED_FIELDS.filter((field) => problem[field] === undefined);
  if (missing.length > 0) {
    throw new Error(`Problem ${label} is missing required field(s): ${missing.join(", ")}`);
  }
  if (!problem.starterCode.python) {
    throw new Error(`Problem ${label} needs starterCode.python — paramNames() reads its signature.`);
  }
  const hasTypedStarter = TYPED_LANGUAGES.some((lang) => problem.starterCode[lang]);
  if (hasTypedStarter && (!problem.paramTypes || !problem.returnType)) {
    console.warn(
      `Warning: ${label} has C/C++/Java/C# starter code but no paramTypes/returnType — those runners will be unavailable for it.`
    );
  }
}

async function main() {
  if (newProblems.length === 0) {
    console.log("scripts/new-problems.mjs is empty — nothing to add.");
    return;
  }
  newProblems.forEach(validate);

  const app = initializeApp({
    credential: cert({
      projectId: requireEnv("FIREBASE_PROJECT_ID"),
      clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
      privateKey: requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
  const db = getFirestore(app);
  const collection = db.collection(COLLECTION);

  const existing = await collection.get();
  const existingOrders = new Map(existing.docs.map((doc) => [doc.id, doc.data().order]));
  let nextOrder = existing.empty
    ? 0
    : Math.max(...existing.docs.map((doc) => doc.data().order ?? 0)) + 1;

  const batch = db.batch();
  let added = 0;
  let updated = 0;
  for (const { testCases, ...problem } of newProblems) {
    const isUpdate = existingOrders.has(problem.id);
    const order = isUpdate ? existingOrders.get(problem.id) : nextOrder++;
    batch.set(collection.doc(problem.id), {
      ...problem,
      testCasesJson: JSON.stringify(testCases),
      order,
    });
    if (isUpdate) updated++;
    else added++;
  }
  await batch.commit();

  console.log(`Added ${added} new problem(s), updated ${updated} existing problem(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
