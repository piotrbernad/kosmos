import { describe, it, expect } from "vitest";
import { ClaimSchema } from "./validators";

describe("ClaimSchema", () => {
  const validToken = "AbCdEf0123456789-_AbCdEf0123456789-_AbCdEf0";

  it("accepts a valid token + 8-char password on the boundary", () => {
    const r = ClaimSchema.safeParse({ token: validToken, password: "12345678" });
    expect(r.success).toBe(true);
  });

  it("accepts a token + longer password", () => {
    const r = ClaimSchema.safeParse({
      token: validToken,
      password: "correcthorsebatterystaple",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a missing token", () => {
    const r = ClaimSchema.safeParse({ token: "", password: "12345678" });
    expect(r.success).toBe(false);
  });

  it("rejects an oversize token (>256 chars)", () => {
    const r = ClaimSchema.safeParse({
      token: "a".repeat(257),
      password: "12345678",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a password below the 8-char floor", () => {
    const r = ClaimSchema.safeParse({
      token: validToken,
      password: "1234567",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a missing password", () => {
    const r = ClaimSchema.safeParse({ token: validToken });
    expect(r.success).toBe(false);
  });

  it("rejects a non-string token", () => {
    const r = ClaimSchema.safeParse({ token: 42, password: "12345678" });
    expect(r.success).toBe(false);
  });
});
