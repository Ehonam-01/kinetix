import "server-only";
import { z } from "zod";
import { parseProviderEnv } from "@/config/parse-provider-env";

const bictorysEnvSchema = z.object({
  BICTORYS_SECRET_KEY: z.string().min(1),
  BICTORYS_WEBHOOK_SECRET: z.string().min(1),
});

type BictorysEnv = z.infer<typeof bictorysEnvSchema>;

let cached: BictorysEnv | undefined;

// A function, not a module-level constant — see getMonerooEnv (same repo)
// for why: validating eagerly at import time would make the whole app's
// build/boot depend on Bictorys being configured, when only an actual
// charge/refund/webhook call needs these keys to exist.
export function getBictorysEnv(): BictorysEnv {
  cached ??= parseProviderEnv(bictorysEnvSchema, {
    BICTORYS_SECRET_KEY: process.env.BICTORYS_SECRET_KEY,
    BICTORYS_WEBHOOK_SECRET: process.env.BICTORYS_WEBHOOK_SECRET,
  });
  return cached;
}

let cachedPayoutSecretCode: string | undefined;

// "merchant.secretCode" in the payout request body (Dashboard >
// Developers), a 4-digit transfer PIN distinct from the API key — Bictorys
// requires it only for payouts, never for inbound charges. Kept out of
// getBictorysEnv() deliberately: bundling it in would make every charge
// call fail closed on a PIN that only services/payments/bictorys-payout.ts
// actually needs.
export function getBictorysPayoutSecretCode(): string {
  cachedPayoutSecretCode ??= parseProviderEnv(
    z
      .string()
      .regex(/^\d{4}$/, "BICTORYS_MERCHANT_SECRET_CODE doit être 4 chiffres."),
    process.env.BICTORYS_MERCHANT_SECRET_CODE,
  );
  return cachedPayoutSecretCode;
}
