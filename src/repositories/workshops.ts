import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  ne,
  or,
  sql,
} from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { payments } from "@/db/schema/payments";
import { workshopRegistrations, workshops } from "@/db/schema/workshops";

export const WORKSHOP_SLUG = "atelier-video-ia";

type Workshop = typeof workshops.$inferSelect;

// The sales page's row: its videos, and the first session (Lomé, 14
// November) with its registrations.
export async function getWorkshop(executor: Executor) {
  const workshop = await executor.query.workshops.findFirst({
    where: eq(workshops.slug, WORKSHOP_SLUG),
  });
  if (!workshop) throw new Error("Atelier introuvable.");
  return workshop;
}

// The sessions sold on the page, one per city, in date order.
export function listSessions(executor: Executor, pageId: string) {
  return executor.query.workshops.findMany({
    where: eq(workshops.pageId, pageId),
    orderBy: asc(workshops.startsAt),
  });
}

// A session of the page, or null: an id from a form is checked here.
export async function getSession(
  executor: Executor,
  pageId: string,
  sessionId: string,
) {
  const session = await executor.query.workshops.findFirst({
    where: and(eq(workshops.id, sessionId), eq(workshops.pageId, pageId)),
  });
  return session ?? null;
}

export async function getWorkshopById(executor: Executor, id: string) {
  const workshop = await executor.query.workshops.findFirst({
    where: eq(workshops.id, id),
  });
  if (!workshop) throw new Error("Atelier introuvable.");
  return workshop;
}

// Where a session takes place: its address, or its city until the address
// is set.
export function sessionPlace(workshop: Pick<Workshop, "venue" | "city">) {
  return workshop.venue.trim() || workshop.city || "";
}

// Each session with its live seats, for the sales page and its form.
export async function listSessionsWithAvailability(
  executor: Executor,
  pageId: string,
) {
  const sessions = await listSessions(executor, pageId);
  return Promise.all(
    sessions.map(async (session) => ({
      session,
      ...(await getWorkshopAvailability(executor, session)),
    })),
  );
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

// The number's registration that stops a new one, in any of these
// sessions (one seat per number across the cities): already paid (one with
// something left to pay first), or a payment started so recently that its
// prompt may still be on the phone.
export async function findBlockingRegistration(
  executor: Executor,
  workshopIds: string[],
  whatsapp: string,
  pendingSince: Date,
) {
  if (workshopIds.length === 0) return undefined;
  const paid = await executor.query.workshopRegistrations.findMany({
    where: and(
      inArray(workshopRegistrations.workshopId, workshopIds),
      eq(workshopRegistrations.whatsapp, whatsapp),
      eq(workshopRegistrations.status, "PAID"),
    ),
    orderBy: desc(workshopRegistrations.createdAt),
  });
  const owing = paid.find((r) => r.amountPaid < r.amount);
  if (owing ?? paid[0]) return owing ?? paid[0];
  return executor.query.workshopRegistrations.findFirst({
    where: and(
      inArray(workshopRegistrations.workshopId, workshopIds),
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
