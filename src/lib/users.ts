import "server-only";

import { getDb } from "@/lib/firestore";

const COLLECTION = "users";

export type UserProfileInput = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

/** Called on every sign-in. Keeps a profile per Firebase Auth user in Firestore. */
export async function upsertUserProfile(input: UserProfileInput): Promise<void> {
  const ref = getDb().collection(COLLECTION).doc(input.uid);
  const snapshot = await ref.get();
  const now = new Date().toISOString();
  const profile = {
    email: input.email,
    displayName: input.displayName,
    photoURL: input.photoURL,
    lastLoginAt: now,
  };
  if (snapshot.exists) {
    await ref.set(profile, { merge: true });
  } else {
    await ref.set({ ...profile, createdAt: now });
  }
}
