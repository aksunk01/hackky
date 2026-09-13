import "server-only";

import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { getDb } from "@/lib/firestore";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";
import { getCurrentUser } from "@/lib/auth";
import { API_KEY_PROVIDERS, type ApiKeyProvider } from "@/lib/api-key-providers";

export type { ApiKeyProvider };
export { API_KEY_PROVIDERS };

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

export type UserSettings = {
  displayName: string | null;
  email: string | null;
  shareScoresPublicly: boolean;
  apiKeys: Record<ApiKeyProvider, { isSet: boolean; masked: string | null }>;
};

type StoredApiKeys = Partial<Record<ApiKeyProvider, string>>;

/** Decrypts a stored key, treating a corrupt/unreadable value the same as "not set" rather than throwing. */
function tryDecrypt(encrypted: string | undefined): string | null {
  if (!encrypted) return null;
  try {
    return decryptSecret(encrypted);
  } catch {
    return null;
  }
}

/** Fetches the raw (still-encrypted) API keys stored for a user. */
async function getStoredApiKeys(uid: string): Promise<{ data: FirebaseFirestore.DocumentData; storedKeys: StoredApiKeys }> {
  const snapshot = await getDb().collection(COLLECTION).doc(uid).get();
  const data = snapshot.data() ?? {};
  return { data, storedKeys: (data.apiKeys ?? {}) as StoredApiKeys };
}

/** Returns settings safe to send to the client: real key values are never exposed, only presence + a masked hint. */
export async function getUserSettings(uid: string): Promise<UserSettings> {
  const { data, storedKeys } = await getStoredApiKeys(uid);

  const apiKeys = Object.fromEntries(
    API_KEY_PROVIDERS.map((provider) => {
      const decrypted = tryDecrypt(storedKeys[provider]);
      return [provider, { isSet: Boolean(storedKeys[provider]), masked: decrypted ? maskSecret(decrypted) : null }];
    })
  ) as UserSettings["apiKeys"];

  return {
    displayName: data.displayName ?? null,
    email: data.email ?? null,
    shareScoresPublicly: Boolean(data.shareScoresPublicly),
    apiKeys,
  };
}

/** Returns a decrypted API key for a provider, for internal use only (never sent to the client). */
export async function getDecryptedApiKey(uid: string, provider: ApiKeyProvider): Promise<string | null> {
  const { storedKeys } = await getStoredApiKeys(uid);
  return tryDecrypt(storedKeys[provider]);
}

/** The "look up the signed-in user, then their key for this provider" idiom every AI/voice route needs. */
export async function getCurrentUserApiKey(provider: ApiKeyProvider): Promise<string | null> {
  const user = await getCurrentUser();
  return user ? getDecryptedApiKey(user.uid, provider) : null;
}

export type UserSettingsUpdate = {
  displayName?: string | null;
  shareScoresPublicly?: boolean;
  apiKeys?: Partial<Record<ApiKeyProvider, string | null>>;
};

/** Applies a partial update. A `null` API key value clears that provider's stored key. */
export async function updateUserSettings(uid: string, update: UserSettingsUpdate): Promise<void> {
  const ref = getDb().collection(COLLECTION).doc(uid);
  const patch: Record<string, unknown> = {};

  if (update.displayName !== undefined) patch.displayName = update.displayName;
  if (update.shareScoresPublicly !== undefined) patch.shareScoresPublicly = update.shareScoresPublicly;

  if (update.apiKeys) {
    // A genuinely nested object here (not a dotted string key like
    // "apiKeys.gemini") is required for set(..., {merge: true}) to deep-merge
    // into the existing map instead of creating a literal top-level field
    // whose name contains a dot — set() only parses FieldPath-typed keys as
    // paths, unlike update(), which parses dotted strings.
    const apiKeysPatch: Record<string, unknown> = {};
    for (const provider of API_KEY_PROVIDERS) {
      if (!(provider in update.apiKeys)) continue;
      const value = update.apiKeys[provider];
      apiKeysPatch[provider] = value ? encryptSecret(value) : null;
    }
    if (Object.keys(apiKeysPatch).length > 0) patch.apiKeys = apiKeysPatch;
  }

  if (Object.keys(patch).length > 0) {
    await ref.set(patch, { merge: true });
  }

  // Only saves that touch apiKeys can possibly hit the legacy fields below —
  // skip the extra round trip for profile-only/privacy-only saves.
  if (update.apiKeys) {
    await clearLegacyDottedApiKeyFields(ref);
  }
}

/**
 * One-time self-healing cleanup: an earlier version of this function wrote
 * literal fields named "apiKeys.gemini" etc. (dot included in the field name)
 * instead of nesting them under an "apiKeys" map, so those keys were silently
 * unreadable. `new FieldPath(...)` targets the literal field name rather than
 * parsing the dots as a path, which is what deleting it requires.
 */
async function clearLegacyDottedApiKeyFields(ref: FirebaseFirestore.DocumentReference): Promise<void> {
  const args = API_KEY_PROVIDERS.flatMap((provider) => [new FieldPath(`apiKeys.${provider}`), FieldValue.delete()]) as [
    FieldPath,
    FirebaseFirestore.FieldValue,
    ...unknown[],
  ];
  try {
    await ref.update(...args);
  } catch {
    // Fine if the document has none of these legacy fields to clear.
  }
}

export async function deleteUserData(uid: string): Promise<void> {
  await getDb().collection(COLLECTION).doc(uid).delete();
}
