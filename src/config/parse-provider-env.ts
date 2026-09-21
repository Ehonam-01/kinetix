import "server-only";
import type { z } from "zod";

// Shared by every payment provider's env.*.ts (Moneroo, PayDunya, Bictorys):
// a missing/placeholder key in production is a real, expected misconfiguration
// (not a bug), but schema.parse() throwing a raw ZodError meant that dump —
// full of our own env var names — went straight through each provider's
// {error: err.message} action return to the member's screen, the same class
// of leak fixed for PayDunya's HTTP error bodies (services/payments/paydunya.ts).
// Full detail still goes to the server log for debugging.
export function parseProviderEnv<Schema extends z.ZodTypeAny>(
  schema: Schema,
  values: unknown,
): z.infer<Schema> {
  const result = schema.safeParse(values);
  if (!result.success) {
    console.error("Configuration de paiement invalide :", result.error);
    throw new Error(
      "Le paiement est momentanément indisponible. Veuillez réessayer plus tard.",
    );
  }
  return result.data;
}
