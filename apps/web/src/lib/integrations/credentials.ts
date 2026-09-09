/**
 * AES-256-GCM credential encryption for IntegrationCredential rows.
 * Plaintext must never be logged or returned to the client.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export type EncryptedBlob = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

function deriveKey(): Buffer {
  const secret = process.env.CREDENTIALS_SECRET?.trim();
  if (!secret) {
    // Dev fallback — still deterministic; set CREDENTIALS_SECRET in real use.
    const fallback = process.env.AUTH_SECRET?.trim() || "matos-dev-credentials-secret";
    return createHash("sha256").update(`matos-cred:${fallback}`).digest();
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string): EncryptedBlob {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: enc.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptSecret(blob: EncryptedBlob): string {
  const key = deriveKey();
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(blob.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(blob.authTag, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

/** Mask for UI — never reveal full secret. */
export function maskSecret(value: string, keep = 4): string {
  if (!value) return "";
  if (value.length <= keep) return "•".repeat(value.length);
  return `${"•".repeat(Math.min(12, value.length - keep))}${value.slice(-keep)}`;
}

export function hasCredentialsSecretConfigured(): boolean {
  return Boolean(process.env.CREDENTIALS_SECRET?.trim() || process.env.AUTH_SECRET?.trim());
}
