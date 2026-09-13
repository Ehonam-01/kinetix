import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_TTL_MINUTES = 10;
export const MAX_OTP_ATTEMPTS = 5;

// crypto.randomInt (CSPRNG), not Math.random() — same rigor as the
// signature checks in payments/moneroo.ts, applied to code generation
// rather than comparison.
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

// SHA-256, not bcrypt: an OTP's security comes from its short expiry and
// capped attempt count (see confirm-transfer.ts), not from hash cost —
// bcrypt-ing a 6-digit code on every confirm attempt would just be slow
// for no real benefit.
export function hashOtpCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

// Constant-time comparison, same reasoning as the Moneroo webhook
// signature check (services/payments/moneroo.ts).
export function verifyOtpCode(code: string, hash: string): boolean {
  const candidate = Buffer.from(hashOtpCode(code), "hex");
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}
