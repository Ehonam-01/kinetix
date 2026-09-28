import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isPasswordPwned } from "./pwned-password";

function sha1(value: string) {
  return createHash("sha1").update(value).digest("hex").toUpperCase();
}

function stubRangeApi(body: string, status = 200) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    calls.push(String(url));
    return new Response(body, { status });
  });
  return calls;
}

describe("isPasswordPwned", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("flags a password whose hash suffix is listed, and only sends the 5-char prefix", async () => {
    const hash = sha1("motdepasse123");
    const calls = stubRangeApi(
      `0000000000000000000000000000000000A:3\r\n${hash.slice(5)}:1542\r\n`,
    );
    expect(await isPasswordPwned("motdepasse123")).toBe(true);
    expect(calls).toEqual([
      `https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`,
    ]);
    expect(calls[0]).not.toContain(hash.slice(5));
  });

  it("accepts a password that isn't listed", async () => {
    stubRangeApi("0000000000000000000000000000000000A:3\r\n");
    expect(await isPasswordPwned("Un-Mot-De-Passe-Unique-42!")).toBe(false);
  });

  it("ignores padding entries (count 0)", async () => {
    const hash = sha1("rembourrage");
    stubRangeApi(`${hash.slice(5)}:0\r\n`);
    expect(await isPasswordPwned("rembourrage")).toBe(false);
  });

  it("fails open when the service is down", async () => {
    stubRangeApi("", 503);
    expect(await isPasswordPwned("password")).toBe(false);
    vi.stubGlobal("fetch", async () => {
      throw new Error("réseau indisponible");
    });
    expect(await isPasswordPwned("password")).toBe(false);
  });
});
