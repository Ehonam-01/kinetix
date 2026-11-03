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
  findRegistrationForPayment,
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

const fmtCfa = (value: number) => `${value.toLocaleString("fr-FR")} F`;

// One email per confirmed payment: the seat held by the first, then each
// part received, until it is paid in full.
async function sendConfirmationEmail(
  registration: typeof workshopRegistrations.$inferSelect,
  workshop: typeof workshops.$inferSelect,
  part: { amount: number; first: boolean },
) {
  if (!registration.email) return;
  const url = `${getSiteEnv().SITE_URL}/atelier-video-ia/merci?t=${registration.accessToken}`;
  const left = Math.max(0, registration.amount - registration.amountPaid);
  const subject = part.first
    ? "Ta place à la Kinetix AI Video Masterclass est réservée"
    : left > 0
      ? `Versement de ${fmtCfa(part.amount)} reçu pour la Kinetix AI Video Masterclass`
      : "Ta place à la Kinetix AI Video Masterclass est entièrement payée";
  const balance =
    left > 0
      ? `<p>Tu as versé <strong>${fmtCfa(registration.amountPaid)}</strong> sur ${fmtCfa(registration.amount)}. Il te reste <strong>${fmtCfa(left)}</strong> à payer, en ligne depuis le lien ci-dessous quand tu veux d'ici la masterclass, ou sur place le jour même.</p>`
      : `<p>Ta place est entièrement payée (${fmtCfa(registration.amountPaid)}).</p>`;
  try {
    await resendEmailProvider.sendEmail({
      to: registration.email,
      subject,
      html: `
      <p>Bonjour ${escapeHtml(registration.fullName)},</p>
      <p>Ta place est réservée pour le <strong>${fmtDateTime(workshop.startsAt)}</strong>.</p>
      ${balance}
      <p>Lieu : ${escapeHtml(workshop.venue)}</p>
      <p><a href="${url}">Voir ma réservation${left > 0 ? ", faire un versement" : ""}, rejoindre le groupe WhatsApp et ajouter l'atelier à mon agenda</a></p>
    `,
    });
  } catch (err) {
    // The payment is recorded: the confirmation page doesn't depend on this.
    console.error(
      `Email de confirmation de l'atelier non envoyé (${registration.id}) :`,
      err,
    );
  }
}

// Payment confirmed -> seat held, or one more part of it paid. Reached
// from processWebhookEvent only, so whichever path confirms first
// (webhook, the confirmation page's check, an admin reconcile) is the only
// one that does anything. A payment
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

  const registration = await findRegistrationForPayment(tx, payment);
  if (!registration) {
    alertAdmins(
      `workshop-orphan:${paymentId}`,
      "Paiement d'atelier sans inscription",
      [`Paiement : ${paymentId} (${payment.amount} F)`],
    );
    return;
  }

  // The first payment holds the seat; every one adds to what was received,
  // and the discount code (worth the whole price) only comes once all of it
  // is in. A payment arriving after the registration was marked FAILED (a
  // late confirmation) still holds the seat: the money was taken.
  const first = registration.status !== "PAID";
  // Added in SQL, not from the row read above: two parts confirmed at the
  // same moment must both count.
  let [paid] = await tx
    .update(workshopRegistrations)
    .set({
      status: "PAID",
      amountPaid: sql`${workshopRegistrations.amountPaid} + ${payment.amount}`,
      confirmedAt: sql`coalesce(${workshopRegistrations.confirmedAt}, now())`,
    })
    .where(eq(workshopRegistrations.id, registration.id))
    .returning();
  const amountPaid = paid.amountPaid;
  if (amountPaid >= paid.amount && !paid.discountCode) {
    [paid] = await tx
      .update(workshopRegistrations)
      .set({ discountCode: generateDiscountCode() })
      .where(eq(workshopRegistrations.id, registration.id))
      .returning();
  }

  const workshop = await tx.query.workshops.findFirst({
    where: eq(workshops.id, registration.workshopId),
  });
  if (!workshop) return;

  if (first) {
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
  }
  if (amountPaid > paid.amount) {
    alertAdmins(
      `workshop-overpaid:${registration.id}:${amountPaid}`,
      "Atelier : participant qui a payé plus que le prix",
      [
        `${registration.fullName} (${registration.whatsapp}) a versé ${amountPaid} F pour ${paid.amount} F.`,
        "Le surplus est à rembourser manuellement.",
      ],
    );
  }

  const send = () =>
    sendConfirmationEmail(paid, workshop, { amount: payment.amount, first });
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
