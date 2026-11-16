import { describe, expect, it } from "vitest";
import {
  ADMIN_IDLE_MS,
  adminSessionCookieOptions,
  isFreshAdminSession,
  signAdminSession,
} from "./admin-session";

const KEY = "service-key";
const USER = "6f1c2a7e-0000-4000-8000-000000000001";

describe("admin session cookie", () => {
  it("is fresh for its user within the hour, then stale", () => {
    const now = 1_800_000_000_000;
    const value = signAdminSession(USER, KEY, now);
    expect(isFreshAdminSession(value, USER, KEY, now)).toBe(true);
    expect(isFreshAdminSession(value, USER, KEY, now + ADMIN_IDLE_MS - 1)).toBe(
      true,
    );
    expect(isFreshAdminSession(value, USER, KEY, now + ADMIN_IDLE_MS)).toBe(
      false,
    );
  });

  it("refuses a missing, foreign, forged or moved-forward cookie", () => {
    const now = 1_800_000_000_000;
    const value = signAdminSession(USER, KEY, now);
    expect(isFreshAdminSession(undefined, USER, KEY, now)).toBe(false);
    expect(isFreshAdminSession(value, "someone-else", KEY, now)).toBe(false);
    expect(isFreshAdminSession(value, USER, "other-key", now)).toBe(false);
    const [, , signature] = value.split(".");
    const movedForward = `${USER}.${now + 30 * 60_000}.${signature}`;
    expect(
      isFreshAdminSession(movedForward, USER, KEY, now + 70 * 60_000),
    ).toBe(false);
    expect(isFreshAdminSession("garbage", USER, KEY, now)).toBe(false);
  });

  it("is a browser-session cookie: no lifetime of its own", () => {
    expect(adminSessionCookieOptions).not.toHaveProperty("maxAge");
    expect(adminSessionCookieOptions).not.toHaveProperty("expires");
    expect(adminSessionCookieOptions.httpOnly).toBe(true);
  });
});
