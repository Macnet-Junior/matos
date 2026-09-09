import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, maskSecret } from "./credentials";

describe("credentials encryption", () => {
  it("roundtrips plaintext", () => {
    const blob = encryptSecret("sk_test_secret_value");
    expect(blob.ciphertext).toBeTruthy();
    expect(blob.iv).toBeTruthy();
    expect(blob.authTag).toBeTruthy();
    expect(decryptSecret(blob)).toBe("sk_test_secret_value");
  });

  it("masks secrets for UI", () => {
    expect(maskSecret("sk_abcdefghij")).toMatch(/•+ghij$/);
  });
});
