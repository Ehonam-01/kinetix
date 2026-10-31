"use server";

import { redirect } from "next/navigation";
import {
  getClientIp,
  isRateLimited,
  RATE_LIMIT_MESSAGE,
} from "@/lib/rate-limit";
import { getTrustedOrigin } from "@/lib/trusted-origin";
import {
  workshopRegistrationSchema,
  type WorkshopRegistrationInput,
} from "@/schemas/workshop";
import { checkWorkshopRegistration } from "@/services/workshops/check-status";
import { registerForWorkshop } from "@/services/workshops/register";

type RegisterResult = { error: string | null; full: boolean };

// {error}-return convention, same as dashboard/subscription/actions.ts: a
// provider refusing the charge is an expected outcome the form must show.
// Public: there is no account here, so the limits are per number (each call
// pushes a payment prompt to a phone) and, much wider, per IP.
export async function registerForWorkshopAction(
  input: WorkshopRegistrationInput,
): Promise<RegisterResult> {
  const parsed = workshopRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, full: false };
  }
  const { whatsapp, paymentPhone } = parsed.data;

  const limited =
    (await isRateLimited("workshopRegistration", `phone:${whatsapp}`)) ||
    (await isRateLimited(
      "workshopRegistrationByIp",
      `ip:${await getClientIp()}`,
    ));
  if (limited) return { error: RATE_LIMIT_MESSAGE, full: false };

  const origin = await getTrustedOrigin();
  let target: string;
  try {
    const result = await registerForWorkshop({
      ...parsed.data,
      paymentPhone: paymentPhone || whatsapp,
      origin,
    });
    if (result.outcome === "FULL") return { error: null, full: true };
    if (result.outcome === "ALREADY_PAID") {
      return {
        error:
          "Ce numéro est déjà inscrit. Si tu n'as plus ta confirmation, écris-nous sur WhatsApp.",
        full: false,
      };
    }
    if (result.outcome === "IN_PROGRESS") {
      return {
        error:
          "Un paiement est déjà en cours pour ce numéro. Valide-le sur ton téléphone, ou réessaie dans 5 minutes.",
        full: false,
      };
    }
    target =
      result.checkoutUrl ?? `/atelier-video-ia/merci?t=${result.token}`;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Une erreur est survenue.",
      full: false,
    };
  }
  redirect(target);
}

export async function checkWorkshopRegistrationAction(token: string) {
  if (await isRateLimited("workshopStatus", `token:${token}`)) {
    return "PENDING" as const;
  }
  return checkWorkshopRegistration(token);
}
