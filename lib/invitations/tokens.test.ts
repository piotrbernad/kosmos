import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { generateRawToken, hashToken } from "./tokens";

describe("generateRawToken", () => {
  it("returns a base64url string (no +, /, or = characters)", () => {
    for (let i = 0; i < 50; i++) {
      const t = generateRawToken();
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("is long enough to carry ~256 bits of entropy", () => {
    // 32 bytes → 43 base64url characters (no padding).
    const t = generateRawToken();
    expect(t.length).toBe(43);
  });

  it("produces different tokens across calls (no obvious collision)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1_000; i++) {
      const t = generateRawToken();
      expect(seen.has(t)).toBe(false);
      seen.add(t);
    }
  });
});

describe("hashToken", () => {
  it("returns a 64-char lowercase hex sha256", () => {
    const h = hashToken("some-token");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same input, same hash (lookup depends on this)", () => {
    const a = hashToken("token-abc");
    const b = hashToken("token-abc");
    expect(a).toBe(b);
  });

  it("differs across inputs", () => {
    const a = hashToken("token-a");
    const b = hashToken("token-b");
    expect(a).not.toBe(b);
  });

  it("matches a manual sha256 of the same input (spec check)", () => {
    const t = "hello world";
    const manual = createHash("sha256").update(t, "utf8").digest("hex");
    expect(hashToken(t)).toBe(manual);
  });

  it("differs from a tampered token by one character", () => {
    const t = generateRawToken();
    // Flip the first char to some other valid base64url char to guarantee change.
    const flipped = (t[0] === "A" ? "B" : "A") + t.slice(1);
    expect(hashToken(t)).not.toBe(hashToken(flipped));
  });
});
