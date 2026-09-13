// One-off migration: copies every row out of the old MySQL interview_sessions
// table into the Firestore collection that replaced it. Re-runnable — each
// row is written with .set(), so running it again just re-syncs the same data.
//
// mysql2 isn't a project dependency anymore (the app talks to Firestore only),
// so install it first: npm install --no-save mysql2
// Usage: node --env-file=.env scripts/migrate-mysql-to-firestore.mjs

import mysql from "mysql2/promise";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const COLLECTION = "interview_sessions";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function utcIso(value) {
  return new Date(value.replace(" ", "T") + "Z").toISOString();
}

function jsonValue(value) {
  return typeof value === "string" ? JSON.parse(value) : value;
}

async function main() {
  const conn = await mysql.createConnection({
    host: requireEnv("MYSQL_HOST"),
    port: Number(process.env.MYSQL_PORT || 3306),
    user: requireEnv("MYSQL_USER"),
    password: process.env.MYSQL_PASSWORD ?? "",
    database: requireEnv("MYSQL_DATABASE"),
    ssl: process.env.MYSQL_SSL === "1"
      ? { rejectUnauthorized: true, ...(process.env.MYSQL_SSL_CA ? { ca: process.env.MYSQL_SSL_CA } : {}) }
      : undefined,
    timezone: "Z",
    dateStrings: true,
  });

  const app = initializeApp({
    credential: cert({
      projectId: requireEnv("FIREBASE_PROJECT_ID"),
      clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
      privateKey: requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
  const db = getFirestore(app);

  const [rows] = await conn.execute("SELECT * FROM interview_sessions");
  console.log(`Found ${rows.length} row(s) in MySQL.`);

  let migrated = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const doc = {
        ownerId: row.owner_id.toString("hex"),
        problemId: row.problem_id,
        problemTitle: row.problem_title,
        transcript: jsonValue(row.transcript_json),
        finalCode: row.final_code,
        evaluation: jsonValue(row.evaluation_json),
        overallScore: row.overall_score,
        testsPassed: row.tests_passed,
        testsTotal: row.tests_total,
        mocked: Boolean(row.mocked),
        startedAt: utcIso(row.started_at),
        completedAt: utcIso(row.completed_at),
      };
      await db.collection(COLLECTION).doc(row.id).set(doc);
      migrated++;
    } catch (err) {
      failed++;
      console.error(`Failed to migrate session ${row.id}:`, err);
    }
  }

  console.log(`Migrated ${migrated}/${rows.length} session(s). ${failed} failure(s).`);
  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
