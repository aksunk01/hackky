import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";

const globalApp = globalThis as typeof globalThis & { interviewFirebaseApp?: App };

export function getFirebaseAdminApp(): App {
  if (globalApp.interviewFirebaseApp) return globalApp.interviewFirebaseApp;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY."
    );
  }

  const app = getApps()[0] ?? initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      // .env files can't hold literal newlines, so the key is stored with
      // escaped \n sequences and unescaped here.
      privateKey: privateKey.replace(/\\n/g, "\n"),
    }),
  });
  globalApp.interviewFirebaseApp = app;
  return app;
}
