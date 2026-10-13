"use server";

import { cookies } from "next/headers";
import {
  isIpRateLimited,
  isRateLimited,
  RATE_LIMIT_MESSAGE,
} from "@/lib/rate-limit";
import { forgotPasswordSchema } from "@/schemas/auth";
import {
  RECOVERY_REQUEST_COOKIE_NAME,
  recoveryRequestCookieOptions,
} from "@/services/auth/password-recovery";
import { requestPasswordReset } from "@/services/auth/request-password-reset";

export async function forgotPasswordAction(input: unknown) {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
  }
  // Per IP and per target address: each call emails someone, so this is
  // the one form that could otherwise flood an arbitrary inbox.
  const [ipLimited, emailLimited] = await Promise.all([
    isIpRateLimited("passwordResetByIp"),
    isRateLimited(
      "passwordResetByEmail",
      `email:${parsed.data.email.toLowerCase()}`,
    ),
  ]);
  if (ipLimited || emailLimited) return { error: RATE_LIMIT_MESSAGE };
  const result = await requestPasswordReset(parsed.data);
  if (!result.error) {
    // Lets auth/callback know the link opened in this browser is a reset
    // link (services/auth/password-recovery.ts).
    (await cookies()).set(
      RECOVERY_REQUEST_COOKIE_NAME,
      "1",
      recoveryRequestCookieOptions,
    );
  }
  return result;
}
