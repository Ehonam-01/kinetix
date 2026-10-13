// The recovery-email password reset (security audit SEC-03, SEC-04): a new
// password is only accepted from a session that came through the recovery
// link — never from just any signed-in session — and every other session
// is signed out afterwards.
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = {
  updateUser: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
};
const cookieJar = new Map<string, string>();
let currentUser: { id: string } | null = null;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: session }),
}));
vi.mock("./session", () => ({ getAuthUser: async () => currentUser }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined,
    delete: (name: string) => cookieJar.delete(name),
  }),
}));
vi.mock("@/lib/pwned-password", () => ({
  isPasswordPwned: async () => false,
  PWNED_PASSWORD_MESSAGE: "pwned",
}));
vi.mock("@/lib/rate-limit", () => ({
  isRateLimited: async () => false,
  RATE_LIMIT_MESSAGE: "limite",
}));
vi.mock("@/config/env.supabase-admin", () => ({
  getSupabaseAdminEnv: () => ({ SUPABASE_SERVICE_ROLE_KEY: "test-key" }),
}));

const MEMBER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const input = {
  password: "nouveauMotDePasse2",
  confirmPassword: "nouveauMotDePasse2",
};

describe("updatePassword (recovery link)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieJar.clear();
    currentUser = { id: MEMBER };
    session.updateUser.mockResolvedValue({ error: null });
  });

  it("refuses a signed-in session that didn't come through the email link", async () => {
    const { updatePassword, RECOVERY_EXPIRED_MESSAGE } =
      await import("./update-password");
    expect(await updatePassword(input)).toEqual({
      error: RECOVERY_EXPIRED_MESSAGE,
    });
    expect(session.updateUser).not.toHaveBeenCalled();
  });

  it("refuses a proof issued for another account, tampered or expired", async () => {
    const { updatePassword } = await import("./update-password");
    const { createRecoveryProof, RECOVERY_COOKIE_NAME, RECOVERY_TTL_MS } =
      await import("./password-recovery");

    cookieJar.set(RECOVERY_COOKIE_NAME, createRecoveryProof(OTHER));
    expect((await updatePassword(input)).error).toBeTruthy();

    const forged = createRecoveryProof(MEMBER).replace(/.$/, (c) =>
      c === "0" ? "1" : "0",
    );
    cookieJar.set(RECOVERY_COOKIE_NAME, forged);
    expect((await updatePassword(input)).error).toBeTruthy();

    cookieJar.set(
      RECOVERY_COOKIE_NAME,
      createRecoveryProof(MEMBER, Date.now() - RECOVERY_TTL_MS - 1000),
    );
    expect((await updatePassword(input)).error).toBeTruthy();

    // A hand-written proof without the server's key.
    cookieJar.set(RECOVERY_COOKIE_NAME, `${MEMBER}.${Date.now() + 60000}.abc`);
    expect((await updatePassword(input)).error).toBeTruthy();

    expect(session.updateUser).not.toHaveBeenCalled();
  });

  it("changes the password with a valid proof, then signs out other sessions", async () => {
    const { updatePassword } = await import("./update-password");
    const { createRecoveryProof, RECOVERY_COOKIE_NAME } =
      await import("./password-recovery");
    cookieJar.set(RECOVERY_COOKIE_NAME, createRecoveryProof(MEMBER));

    expect(await updatePassword(input)).toEqual({ error: null });
    expect(session.updateUser).toHaveBeenCalledWith({
      password: "nouveauMotDePasse2",
    });
    expect(session.signOut).toHaveBeenCalledWith({ scope: "others" });
    // The proof is used once.
    expect(cookieJar.has(RECOVERY_COOKIE_NAME)).toBe(false);
  });

  it("never shows Supabase's own error text", async () => {
    const { updatePassword } = await import("./update-password");
    const { createRecoveryProof, RECOVERY_COOKIE_NAME } =
      await import("./password-recovery");
    vi.spyOn(console, "error").mockImplementation(() => {});
    cookieJar.set(RECOVERY_COOKIE_NAME, createRecoveryProof(MEMBER));
    session.updateUser.mockResolvedValue({
      error: { code: "unexpected_failure", message: "internal db detail" },
    });
    const { error } = await updatePassword(input);
    expect(error).not.toContain("internal db detail");
  });
});
