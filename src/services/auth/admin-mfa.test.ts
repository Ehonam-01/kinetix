import { beforeEach, describe, expect, it, vi } from "vitest";

// Who's signed in, and what Supabase answers about their second factor.
let role: "ADMIN" | "USER" = "ADMIN";
let aal: { currentLevel: string; nextLevel: string } | "error" = {
  currentLevel: "aal1",
  nextLevel: "aal1",
};
const aalCalls: (string | undefined)[] = [];

vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("@/services/auth/ensure-profile", () => ({
  ensureProfile: async () => ({ id: "u1", role, status: "ACTIVE" }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u1" } } }),
      getSession: async () => ({
        data: { session: { access_token: "jeton-de-session" } },
      }),
      mfa: {
        getAuthenticatorAssuranceLevel: async (jwt?: string) => {
          aalCalls.push(jwt);
          return aal === "error"
            ? { data: null, error: new Error("indisponible") }
            : { data: aal, error: null };
        },
      },
    },
  }),
}));

async function expectRedirectTo(promise: Promise<unknown>, path: string) {
  await expect(promise).rejects.toMatchObject({
    digest: expect.stringContaining(path),
  });
}

describe("requireAdmin with a second factor", () => {
  beforeEach(() => {
    role = "ADMIN";
    aalCalls.length = 0;
  });

  it("lets an admin through once the session passed the second factor", async () => {
    aal = { currentLevel: "aal2", nextLevel: "aal2" };
    const { requireAdmin } = await import("./current-user");
    await expect(requireAdmin()).resolves.toMatchObject({
      profile: { role: "ADMIN" },
    });
    // The session token is handed to Supabase to validate, not decoded locally.
    expect(aalCalls).toEqual(["jeton-de-session"]);
  });

  it("sends an admin with an enrolled factor but no code yet to /mfa", async () => {
    aal = { currentLevel: "aal1", nextLevel: "aal2" };
    const { requireAdmin } = await import("./current-user");
    await expectRedirectTo(requireAdmin(), "/mfa");
  });

  it("sends an admin who never enrolled to /mfa", async () => {
    aal = { currentLevel: "aal1", nextLevel: "aal1" };
    const { requireAdmin } = await import("./current-user");
    await expectRedirectTo(requireAdmin(), "/mfa");
  });

  it("fails closed when Supabase can't be asked", async () => {
    aal = "error";
    const { requireAdmin } = await import("./current-user");
    await expectRedirectTo(requireAdmin(), "/mfa");
  });

  it("still sends a non-admin to the dashboard, without asking for MFA", async () => {
    role = "USER";
    aal = { currentLevel: "aal2", nextLevel: "aal2" };
    const { requireAdmin } = await import("./current-user");
    await expectRedirectTo(requireAdmin(), "/dashboard");
    expect(aalCalls).toEqual([]);
  });
});
