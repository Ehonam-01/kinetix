// Changing the password from the settings: the current password is checked
// on a separate client, so the member's own session — the admin's aal2
// session in particular — is never signed in again (which used to drop it
// to aal1 and make Supabase refuse the change), and each refusal gets a
// message that says why.
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = {
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
};
const throwaway = {
  signInWithPassword: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
};

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: session }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: throwaway }),
}));
vi.mock("@/lib/pwned-password", () => ({
  isPasswordPwned: async () => false,
  PWNED_PASSWORD_MESSAGE: "pwned",
}));
vi.mock("@/config/env.public", () => ({
  publicEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  },
}));

const input = {
  currentPassword: "ancienMotDePasse1",
  password: "nouveauMotDePasse2",
  confirmPassword: "nouveauMotDePasse2",
};

describe("changePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session.getUser.mockResolvedValue({
      data: { user: { email: "admin@example.com" } },
    });
    throwaway.signInWithPassword.mockResolvedValue({ error: null });
    session.updateUser.mockResolvedValue({ error: null });
  });

  it("checks the current password apart, keeping the member's session", async () => {
    const { changePassword } = await import("./change-password");
    expect(await changePassword(input)).toEqual({ error: null });
    expect(throwaway.signInWithPassword).toHaveBeenCalledWith({
      email: "admin@example.com",
      password: "ancienMotDePasse1",
    });
    expect(throwaway.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(session.signInWithPassword).not.toHaveBeenCalled();
    expect(session.updateUser).toHaveBeenCalledWith({
      password: "nouveauMotDePasse2",
    });
  });

  it("refuses a wrong current password without changing anything", async () => {
    const { changePassword } = await import("./change-password");
    throwaway.signInWithPassword.mockResolvedValue({ error: { message: "x" } });
    expect(await changePassword(input)).toEqual({
      error: "Mot de passe actuel incorrect.",
    });
    expect(session.updateUser).not.toHaveBeenCalled();
  });

  it("explains Supabase's refusals", async () => {
    const { changePassword } = await import("./change-password");
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const [code, expected] of [
      ["same_password", "différent de l'actuel"],
      ["weak_password", "trop faible"],
      ["insufficient_aal", "double authentification"],
      ["reauthentication_needed", "reconnectez-vous"],
    ]) {
      session.updateUser.mockResolvedValue({ error: { code, message: code } });
      expect((await changePassword(input)).error).toContain(expected);
    }
  });
});
