import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/db/client";
import { payments } from "@/db/schema/payments";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import { monerooProvider } from "./moneroo";

function splitFullName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = fullName.trim();
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) return { firstName: trimmed, lastName: trimmed };
  return {
    firstName: trimmed.slice(0, spaceIndex),
    lastName: trimmed.slice(spaceIndex + 1),
  };
}

// Entry point for the MOBILE_MONEY method: creates a Moneroo checkout and
// records a PENDING payment locally. Confirmation only ever happens later,
// via the signed webhook (see app/api/webhooks/moneroo/route.ts) — this
// function never activates anything itself.
export async function initiateRegistrationPayment(input: {
  beneficiaryUserId: string;
  email: string;
  fullName: string;
  returnUrl: string;
}) {
  const amount = await getCurrentParameterValue(db, "registration_price");
  const idempotencyKey = `REGISTRATION:${input.beneficiaryUserId}:${randomUUID()}`;
  const { firstName, lastName } = splitFullName(input.fullName);

  const intent = await monerooProvider.createPayment({
    amount,
    description: "Inscription à la plateforme",
    customer: { email: input.email, firstName, lastName },
    returnUrl: input.returnUrl,
    idempotencyKey,
    metadata: { beneficiary_user_id: input.beneficiaryUserId },
  });

  const [payment] = await db
    .insert(payments)
    .values({
      beneficiaryUserId: input.beneficiaryUserId,
      purpose: "REGISTRATION",
      method: "MOBILE_MONEY",
      amount,
      provider: "MONEROO",
      providerReference: intent.providerReference,
      idempotencyKey,
      status: "PENDING",
    })
    .returning();

  return { payment, checkoutUrl: intent.checkoutUrl };
}
