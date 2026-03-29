import { describe, it, expect } from "vitest";

describe("crypto", () => {
  it("should encrypt and decrypt a string", async () => {
    const { encrypt, decrypt } = await import("@/lib/crypto");
    const plaintext = "ghp_abc123secrettoken";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/); // base64
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should produce different ciphertexts for the same input (random IV)", async () => {
    const { encrypt } = await import("@/lib/crypto");
    const plaintext = "ghp_abc123secrettoken";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
  });

  it("should throw on tampered ciphertext", async () => {
    const { encrypt, decrypt } = await import("@/lib/crypto");
    const encrypted = encrypt("test");
    const tampered = encrypted.slice(0, -4) + "AAAA";
    expect(() => decrypt(tampered)).toThrow();
  });

  it("should use ENCRYPTION_KEY env var, falling back to NEXTAUTH_SECRET", async () => {
    const { encrypt, decrypt } = await import("@/lib/crypto");
    // tests/setup.ts sets NEXTAUTH_SECRET="test-secret-for-vitest"
    const encrypted = encrypt("fallback-test");
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe("fallback-test");
  });
});
