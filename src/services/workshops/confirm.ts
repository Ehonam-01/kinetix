import "server-only";
import { randomInt } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { getSiteEnv } from "@/config/env.site";
import type { Executor } from "@/db/executor";
import { payments } from "@/db/schema/payments";
import { workshopRegistrations, workshops } from "@/db/schema/workshops";
import { escapeHtml } from "@/lib/escape-html";
import {
  countPaidRegistrations,
  findOtherPaidRegistration,
  findRegistrationByPaymentId,
} from "@/repositories/workshops";
import { alertAdmins } from "@/services/notifications/admin-alerts";
import { resendEmailProvider } from "@/services/notifications/resend-email";

// No 0/O or 1/I: read aloud, typed on a phone.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateDiscountCode() {
  let code = "ATELIER-";
  for (let i = 0; i < 8; i++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

const fmtDateTime = (date: Date) =>
  date.toLocaleString("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Lome",
  });

async function sendConfirmationEmail(
  registration: typeof workshopRegistrations.$inferSelect,
  workshop: typeof workshops.$inferSelect,
) {
  if (!registration.email) return;
  const url = `${getSiteEnv().SITE_URL}/atelier-video-ia/merci?t=${registration.accessToken}`;
  try {
    await resendEmailProvider.sendEmail({
      to: registration.email,
      subject: "Ta place à la Kinetix AI Video Masterclass est confirmée",
      html: `
      <p>Bonjour ${escapeHtml(registration.fullName)},</p>
      <p>Ta place est confirmée pour le <strong>${fmtDateTime(workshop.startsAt)}</strong>.</p>
      <p>Lieu : ${escapeHtml(workshop.venue)}</p>
      <p><a href="${url}">Voir ma confirmation, rejoindre le groupe WhatsApp et ajouter l'atelier à mon agenda</a></p>
    `,
    });
  } catch (err) {
    // The seat is paid: its confirmation page doesn't depend on this email.
    console.error(
      `Email de confirmation de l'atelier non envoyé (${registration.id}) :`,
      err,
    );
  }
}

// Payment confirmed -> seat confirmed, reached from processWebhookEvent
// only, so whichever path confirms first (webhook, the confirmation page's
// check, an admin reconcile) is the only one that does anything. A payment
// never fails for lack of a seat: the money is taken, and past the capacity
// the seat is kept and the admins are told (explicit user decision).
export async function confirmWorkshopRegistration(
  tx: Executor,
  paymentId: string,
) {
  const [payment] = await tx
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .for("update");
  if (!payment || payment.status === "CONFIRMED") return;

  await tx
    .update(payments)
    .set({ status: "CONFIRMED", confirmedAt: sql`now()` })
    .where(eq(payments.id, paymentId));

  const registration = await findRegistrationByPaymentId(tx, paymentId);
  if (!registration) {
    alertAdmins(
      `workshop-orphan:${paymentId}`,
      "Paiement d'atelier sans inscription",
      [`Paiement : ${paymentId} (${payment.amount} F)`],
    );
    return;
  }

  const [paid] = await tx
    .update(workshopRegistrations)
    .set({
      status: "PAID",
      confirmedAt: sql`now()`,
      discountCode: generateDiscountCode(),
    })
    .where(eq(workshopRegistrations.id, registration.id))
    .returning();

  const workshop = await tx.query.workshops.findFirst({
    where: eq(workshops.id, registration.workshopId),
  });
  if (!workshop) return;

  const paidCount = await countPaidRegistrations(tx, workshop.id);
  if (paidCount > workshop.capacity) {
    alertAdmins(
      `workshop-over-capacity:${workshop.id}:${paidCount}`,
      "Atelier : capacité dépassée",
      [
        `${paidCount} inscrits payés pour ${workshop.capacity} places.`,
        `Dernier inscrit : ${registration.fullName} (${registration.whatsapp}).`,
      ],
    );
  }
  if (await findOtherPaidRegistration(tx, registration)) {
    alertAdmins(
      `workshop-duplicate:${registration.id}`,
      "Atelier : numéro inscrit et payé deux fois",
      [
        `${registration.fullName} (${registration.whatsapp}) a deux inscriptions payées.`,
        "L'une des deux est à rembourser manuellement.",
      ],
    );
  }

  const send = () => sendConfirmationEmail(paid, workshop);
  try {
    // After the response, once this transaction is committed.
    after(send);
  } catch {
    // Outside a request (scripts): sent right away.
    void send();
  }
}

// A failed payment frees the number, which can try again.
export async function failWorkshopRegistration(
  tx: Executor,
  paymentId: string,
) {
  await tx
    .update(workshopRegistrations)
    .set({ status: "FAILED" })
    .where(
      and(
        eq(workshopRegistrations.paymentId, paymentId),
        eq(workshopRegistrations.status, "PENDING"),
      ),
    );
}
