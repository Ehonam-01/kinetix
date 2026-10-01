import { beforeEach, describe, expect, it, vi } from "vitest";

// Who's signed in (validated by Supabase's getUser), their factors, and the
// session token in the cookies.
let role: "ADMIN" | "USER" = "ADMIN";
let factors: { status: string }[] = [];
let session: { access_token: string } | null = null;
let getUserCalls = 0;

function token(claims: Record<string, unknown>) {
  const encode = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode(claims)}.signature`;
}
const inOneHour = () => Math.floor(Date.now() / 1000) + 3600;

vi.mock("@/db/client", () => ({ db: {} }));
vi.mock("@/services/auth/ensure-profile", () => ({
  ensureProfile: async () => ({ id: "u1", role, status: "ACTIVE" }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => {
        getUserCalls += 1;
        return { data: { user: { id: "u1", factors } } };
      },
      getSession: async () => ({ data: { session } }),
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
    factors = [{ status: "verified" }];
    session = null;
    getUserCalls = 0;
  });

  it("lets an admin through once the session passed the second factor", async () => {
    session = {
      access_token: token({ sub: "u1", exp: inOneHour(), aal: "aal2" }),
    };
    const { requireAdmin } = await import("./current-user");
    await expect(requireAdmin()).resolves.toMatchObject({
      profile: { role: "ADMIN" },
    });
    // The level comes from the session Supabase validated through getUser —
    // the mocked client has no mfa API at all, so asking Supabase for the
    // assurance level again would throw here. (React's cache() makes the
    // two getUser calls one inside a real request; not in a plain test.)
    expect(getUserCalls).toBeGreaterThan(0);
  });

  it("sends an admin with an enrolled factor but no code yet to /mfa", async () => {
    session = {
      access_token: token({ sub: "u1", exp: inOneHour(), aal: "aal1" }),
    };
    const { requireAdmin } = await import("./current-user");
    await expectRedirectTo(requireAdmin(), "/mfa");
    const { getAdminMfaState } = await import("./admin-mfa");
    expect(await getAdminMfaState()).toEqual({ status: "needs-code" });
  });

  it("sends an admin who never enrolled to /mfa", async () => {
    factors = [];
    session = {
      access_token: token({ sub: "u1", exp: inOneHour(), aal: "aal1" }),
    };
    const { getAdminMfaState } = await import("./admin-mfa");
    expect(await getAdminMfaState()).toEqual({ status: "needs-enrollment" });
  });

  it("fails closed on a session that isn't the validated user's, has expired, or is missing", async () => {
    const { requireAdmin } = await import("./current-user");
    session = {
      access_token: token({
        sub: "someone-else",
        exp: inOneHour(),
        aal: "aal2",
      }),
    };
    await expectRedirectTo(requireAdmin(), "/mfa");
    session = { access_token: token({ sub: "u1", exp: 1000, aal: "aal2" }) };
    await expectRedirectTo(requireAdmin(), "/mfa");
    session = { access_token: "pas-un-jeton" };
    await expectRedirectTo(requireAdmin(), "/mfa");
    session = null;
    await expectRedirectTo(requireAdmin(), "/mfa");
  });

  it("still sends a non-admin to the dashboard, without asking for MFA", async () => {
    role = "USER";
    session = {
      access_token: token({ sub: "u1", exp: inOneHour(), aal: "aal2" }),
    };
    const { requireAdmin } = await import("./current-user");
    await expectRedirectTo(requireAdmin(), "/dashboard");
  });
});
