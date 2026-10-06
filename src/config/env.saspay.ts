import "server-only";
import { z } from "zod";
import { parseProviderEnv } from "@/config/parse-provider-env";

let cachedKey: string | undefined;
let cachedWebhookSecret: string | undefined;

// The API key (sk_test_... or sk_live_..., SasPay dashboard > Développeur)
// — the only thing a charge or a status check needs. Read lazily, same
// reasoning as getBictorysEnv: the app must build and boot without
// SasPay configured.
export function getSaspaySecretKey(): string {
  cachedKey ??= parseProviderEnv(
    z
      .string()
      .regex(
        /^sk_(test|live)_/,
        "SASPAY_SECRET_KEY doit commencer par sk_test_ ou sk_live_.",
      ),
    process.env.SASPAY_SECRET_KEY,
  );
  return cachedKey;
}

// The webhook signing secret, shown once by the SasPay dashboard when the
// webhook is created (Webhooks). Kept apart from the API key so a missing
// webhook secret never blocks a member from paying — only the webhook
// route needs it, and the payment is still confirmed by polling without it.
export function getSaspayWebhookSecret(): string {
  cachedWebhookSecret ??= parseProviderEnv(
    z.string().min(1),
    process.env.SASPAY_WEBHOOK_SECRET,
  );
  return cachedWebhookSecret;
}
