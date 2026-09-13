import { describe, expect, it } from "vitest";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "./auth";

describe("registerSchema", () => {
  it("accepts a valid registration payload", () => {
    const result = registerSchema.safeParse({
      fullName: "Ama Koffi",
      username: "ama_k",
      email: "ama@example.com",
      password: "supersecret1",
    });
    expect(result.success).toBe(true);
  });

  it("trims the full name and email, trims and lowercases the username", () => {
    const result = registerSchema.parse({
      fullName: "  Ama Koffi  ",
      username: "  Ama_K  ",
      email: "  ama@example.com  ",
      password: "supersecret1",
    });
    expect(result.fullName).toBe("Ama Koffi");
    expect(result.username).toBe("ama_k");
    expect(result.email).toBe("ama@example.com");
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      fullName: "Ama Koffi",
      username: "ama_k",
      email: "ama@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({
      fullName: "Ama Koffi",
      username: "ama_k",
      email: "not-an-email",
      password: "supersecret1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a full name that is too short", () => {
    const result = registerSchema.safeParse({
      fullName: "A",
      username: "ama_k",
      email: "ama@example.com",
      password: "supersecret1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a username shorter than 3 characters", () => {
    const result = registerSchema.safeParse({
      fullName: "Ama Koffi",
      username: "ak",
      email: "ama@example.com",
      password: "supersecret1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a username with characters other than lowercase letters, digits, and underscore", () => {
    const result = registerSchema.safeParse({
      fullName: "Ama Koffi",
      username: "ama koffi!",
      email: "ama@example.com",
      password: "supersecret1",
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires a non-empty password", () => {
    const result = loginSchema.safeParse({
      email: "ama@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts any non-empty password (server verifies it, not this schema)", () => {
    const result = loginSchema.safeParse({
      email: "ama@example.com",
      password: "x",
    });
    expect(result.success).toBe(true);
  });
});

describe("forgotPasswordSchema", () => {
  it("rejects an invalid email", () => {
    const result = forgotPasswordSchema.safeParse({ email: "nope" });
    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("rejects a password shorter than 8 characters", () => {
    const result = resetPasswordSchema.safeParse({ password: "short" });
    expect(result.success).toBe(false);
  });

  it("accepts an 8+ character password", () => {
    const result = resetPasswordSchema.safeParse({ password: "supersecret1" });
    expect(result.success).toBe(true);
  });
});
