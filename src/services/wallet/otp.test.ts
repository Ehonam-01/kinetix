import { describe, expect, it } from "vitest";
import { generateOtpCode, hashOtpCode, verifyOtpCode } from "./otp";

describe("generateOtpCode", () => {
  it("always produces a 6-digit, zero-padded string", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateOtpCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });
});

describe("hashOtpCode / verifyOtpCode", () => {
  it("verifies a code against its own hash", () => {
    const code = "042817";
    expect(verifyOtpCode(code, hashOtpCode(code))).toBe(true);
  });

  it("rejects a different code", () => {
    expect(verifyOtpCode("111111", hashOtpCode("222222"))).toBe(false);
  });

  it("is deterministic (same code always hashes the same way)", () => {
    expect(hashOtpCode("123456")).toBe(hashOtpCode("123456"));
  });

  it("does not throw on a malformed stored hash (length mismatch)", () => {
    expect(verifyOtpCode("123456", "not-a-real-hash")).toBe(false);
  });
});
