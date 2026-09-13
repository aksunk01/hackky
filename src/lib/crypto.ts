import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";

// scrypt is deliberately slow; the env var it derives from never changes at
// runtime, so compute it once instead of on every encrypt/decrypt call.
let cachedKey: Buffer | null = null;

function key(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("SETTINGS_ENCRYPTION_KEY is not set. Required to store user-provided API keys.");
  }
  cachedKey = scryptSync(secret, "hackky-settings", 32);
  return cachedKey;
}

/** Encrypts a secret for storage. Returns iv:authTag:ciphertext, all base64. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const [ivB64, tagB64, dataB64] = stored.split(":");
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return plaintext.toString("utf8");
}

export function maskSecret(plaintext: string): string {
  if (plaintext.length <= 4) return "••••";
  return `••••${plaintext.slice(-4)}`;
}
