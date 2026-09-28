import "server-only";
import { createHash } from "node:crypto";

export const PWNED_PASSWORD_MESSAGE =
  "Ce mot de passe apparaît dans des fuites de données connues. Choisissez-en un autre.";

// Free equivalent of Supabase's "leaked password protection" (Pro plan
// only): checks a new password against Have I Been Pwned's public
// Pwned Passwords range API. k-anonymity — only the first 5 hex characters
// of the password's SHA-1 ever leave the server, and the comparison with
// the returned suffixes happens here; "Add-Padding" hides which prefix
// bucket was really requested. Fails open (network error, timeout, non-200
// answer): an outage of this third-party check must never block signups or
// password changes.
export async function isPasswordPwned(password: string): Promise<boolean> {
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  try {
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        headers: { "Add-Padding": "true" },
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
      },
    );
    if (!response.ok) return false;
    const body = await response.text();
    return body.split("\n").some((line) => {
      const [candidate, count] = line.trim().split(":");
      // Padding entries come back with a count of 0.
      return candidate === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}
