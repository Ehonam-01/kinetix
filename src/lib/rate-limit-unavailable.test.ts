// Rate limiting unavailable in production (security audit SEC-05): the
// kinds that send a code or a reset link, or change a password, are
// refused; everything else — sign-in included — goes through; the admins
// are alerted either way.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const alertAdmins = vi.fn();
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/services/notifications/admin-alerts", () => ({ alertAdmins }));

describe("rate limiting without Upstash", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    alertAdmins.mockClear();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.VITEST;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...saved };
  });

  it("refuses OTP codes, reset links and password changes in production", async () => {
    const { isRateLimited } = await import("./rate-limit");
    for (const kind of [
      "otpRequest",
      "passwordResetByIp",
      "passwordResetByEmail",
      "passwordChange",
    ] as const) {
      expect(await isRateLimited(kind, "ip:1.2.3.4")).toBe(true);
    }
    expect(alertAdmins).toHaveBeenCalled();
  });

  it("lets sign-in and everything else through", async () => {
    const { isRateLimited } = await import("./rate-limit");
    for (const kind of [
      "loginByIp",
      "loginByEmail",
      "signupByIp",
      "otpConfirm",
      "paymentStart",
      "lessonPost",
    ] as const) {
      expect(await isRateLimited(kind, "ip:1.2.3.4")).toBe(false);
    }
  });

  it("lets everything through outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { isRateLimited } = await import("./rate-limit");
    expect(await isRateLimited("otpRequest", "ip:1.2.3.4")).toBe(false);
    expect(alertAdmins).not.toHaveBeenCalled();
  });
});
