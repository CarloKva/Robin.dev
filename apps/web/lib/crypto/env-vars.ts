/**
 * AES-256-GCM encryption for workspace environment variables.
 *
 * Key is read from ENV_VARS_ENCRYPTION_KEY (hex-encoded 32-byte secret).
 * Never use NEXT_PUBLIC_ — this runs server-side only.
 *
 * Format: base64( iv[12] || authTag[16] || ciphertext )
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env["ENV_VARS_ENCRYPTION_KEY"];
  if (!raw) {
    throw new Error("ENV_VARS_ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error("ENV_VARS_ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars)");
  }
  return key;
}

/**
 * Encrypts a key-value record of env vars.
 * Returns a base64-encoded string: iv + authTag + ciphertext.
 */
export function encryptEnvVars(vars: Record<string, string>): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(vars);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypts a base64 ciphertext produced by encryptEnvVars.
 * Returns the original key-value record.
 */
export function decryptEnvVars(ciphertext: string): Record<string, string> {
  const key = getKey();
  const data = Buffer.from(ciphertext, "base64");

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as Record<string, string>;
}
