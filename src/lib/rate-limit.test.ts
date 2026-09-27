import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A fake Ratelimit that allows `tokens` calls per identifier, then denies —
// or throws, to simulate Redis being unreachable.
let throwOnLimit = false;
vi.mock("@upstash/ratelimit", () => {
  class Ratelimit {
    private counts = new Map<string, number>();
    constructor(private readonly options: { limiter: { tokens: number } }) {}
    static slidingWindow(tokens: number) {
      return { tokens };
    }
    async limit(identifier: string) {
      if (throwOnLimit) throw new Error("Redis indisponible");
      const count = (this.counts.get(identifier) ?? 0) + 1;
      this.counts.set(identifier, count);
      return { success: count <= this.options.limiter.tokens };
    }
  }
  return { Ratelimit };
});
vi.mock("@upstash/redis", () => ({ Redis: { fromEnv: () => ({}) } }));

describe("isRateLimited", () => {
  beforeEach(() => {
    vi.resetModules();
    throwOnLimit = false;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails open when Upstash isn't configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const { isRateLimited } = await import("./rate-limit");
    for (let i = 0; i < 50; i++) {
      expect(await isRateLimited("loginByEmail", "email:a@b.c")).toBe(false);
    }
  });

  it("blocks an identifier once its allowance is used up, independently of others", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fake.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake");
    const { isRateLimited } = await import("./rate-limit");

    // loginByEmail allows 5 per window.
    for (let i = 0; i < 5; i++) {
      expect(await isRateLimited("loginByEmail", "email:victim@x.y")).toBe(false);
    }
    expect(await isRateLimited("loginByEmail", "email:victim@x.y")).toBe(true);
    expect(await isRateLimited("loginByEmail", "email:other@x.y")).toBe(false);
    // Separate kinds keep separate counters.
    expect(await isRateLimited("otpConfirm", "email:victim@x.y")).toBe(false);
  });

  it("fails open when Redis errors instead of locking everyone out", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fake.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake");
    throwOnLimit = true;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { isRateLimited } = await import("./rate-limit");
    expect(await isRateLimited("loginByIp", "ip:1.2.3.4")).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
