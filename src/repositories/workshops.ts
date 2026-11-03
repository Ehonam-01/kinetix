import "server-only";
import { and, count, desc, eq, gte, ne, or, sql } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { payments } from "@/db/schema/payments";
import { workshopRegistrations, workshops } from "@/db/schema/workshops";

export const WORKSHOP_SLUG = "atelier-video-ia";

export async function getWorkshop(executor: Executor) {
  const workshop = await executor.query.workshops.findFirst({
    where: eq(workshops.slug, WORKSHOP_SLUG),
  });
  if (!workshop) throw new Error("Atelier introuvable.");
  return workshop;
}

export async function countPaidRegistrations(
  executor: Executor,
  workshopId: string,
) {
  const [row] = await executor
    .select({ value: count() })
    .from(workshopRegistrations)
    .where(
      and(
        eq(workshopRegistrations.workshopId, workshopId),
        eq(workshopRegistrations.status, "PAID"),
      ),
    );
  return row?.value ?? 0;
}

// What the sales page shows: capacity minus registrations really paid.
// "open" is false once the online sale stops, which sends visitors to
// WhatsApp: registrations closed, the workshop started, or no place left.
export async function getWorkshopAvailability(
  executor: Executor,
  workshop: Pick<
    typeof workshops.$inferSelect,
    "id" | "capacity" | "registrationsOpen" | "startsAt"
  >,
) {
  const paid = await countPaidRegistrations(executor, workshop.id);
  const remaining = Math.max(0, workshop.capacity - paid);
  return {
    paid,
    remaining,
    open:
      workshop.registrationsOpen &&
      remaining > 0 &&
      workshop.startsAt.getTime() > Date.now(),
  };
}

export function findRegistrationByToken(executor: Executor, token: string) {
  return executor.query.workshopRegistrations.findFirst({
    where: eq(workshopRegistrations.accessToken, token),
  });
}

// The registration a payment is for: its first payment (paymentId), or a
// later part, which names it in its metadata (services/workshops/pay-more.ts).
export function findRegistrationForPayment(
  executor: Executor,
  payment: { id: string; metadata: unknown },
) {
  const registrationId = (
    payment.metadata as { workshopRegistrationId?: unknown } | null
  )?.workshopRegistrationId;
  return executor.query.workshopRegistrations.findFirst({
    where:
      typeof registrationId === "string"
        ? or(
            eq(workshopRegistrations.paymentId, payment.id),
            eq(workshopRegistrations.id, registrationId),
          )
        : eq(workshopRegistrations.paymentId, payment.id),
  });
}

// The registration's latest payment: its first one, or the last part
// started from its confirmation page.
export async function findLatestRegistrationPayment(
  executor: Executor,
  registrationId: string,
) {
  const [row] = await executor
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.purpose, "WORKSHOP"),
        sql`${payments.metadata}->>'workshopRegistrationId' = ${registrationId}`,
      ),
    )
    .orderBy(desc(payments.createdAt))
    .limit(1);
  return row ?? null;
}

// The number's registration that stops a new one: already paid, or a
// payment started so recently that its prompt may still be on the phone.
export async function findBlockingRegistration(
  executor: Executor,
  workshopId: string,
  whatsapp: string,
  pendingSince: Date,
) {
  const paid = await executor.query.workshopRegistrations.findFirst({
    where: and(
      eq(workshopRegistrations.workshopId, workshopId),
      eq(workshopRegistrations.whatsapp, whatsapp),
      eq(workshopRegistrations.status, "PAID"),
    ),
  });
  if (paid) return paid;
  return executor.query.workshopRegistrations.findFirst({
    where: and(
      eq(workshopRegistrations.workshopId, workshopId),
      eq(workshopRegistrations.whatsapp, whatsapp),
      eq(workshopRegistrations.status, "PENDING"),
      gte(workshopRegistrations.createdAt, pendingSince),
    ),
  });
}

// Another paid registration for this number: someone paid twice.
export function findOtherPaidRegistration(
  executor: Executor,
  registration: { id: string; workshopId: string; whatsapp: string },
) {
  return executor.query.workshopRegistrations.findFirst({
    where: and(
      eq(workshopRegistrations.workshopId, registration.workshopId),
      eq(workshopRegistrations.whatsapp, registration.whatsapp),
      eq(workshopRegistrations.status, "PAID"),
      ne(workshopRegistrations.id, registration.id),
    ),
  });
}

export function listRegistrations(executor: Executor, workshopId: string) {
  return executor.query.workshopRegistrations.findMany({
    where: eq(workshopRegistrations.workshopId, workshopId),
    orderBy: desc(workshopRegistrations.createdAt),
  });
}
