import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { profiles } from "@/db/schema/profiles";
import { workshopRegistrations, workshops } from "@/db/schema/workshops";
import { getSession, getWorkshop } from "@/repositories/workshops";
import {
  adminWorkshopRegistrationSchema,
  workshopPageSchema,
  workshopSessionSchema,
} from "@/schemas/workshop";
import { logAdminAction } from "@/services/admin/audit-log";
import type { Executor } from "@/db/executor";
import { generateDiscountCode } from "./confirm";

async function assertAdmin(tx: Executor, adminUserId: string) {
  const admin = await tx.query.profiles.findFirst({
    where: eq(profiles.id, adminUserId),
  });
  if (admin?.role !== "ADMIN") {
    throw new Error("Seul un administrateur peut gérer l'atelier.");
  }
}

export async function updateWorkshopPage(
  adminUserId: string,
  input: z.input<typeof workshopPageSchema>,
) {
  const values = workshopPageSchema.parse(input);
  return db.transaction(async (tx) => {
    await assertAdmin(tx, adminUserId);
    const workshop = await getWorkshop(tx);
    await tx
      .update(workshops)
      .set({ ...values, updatedAt: sql`now()` })
      .where(eq(workshops.id, workshop.id));
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "WORKSHOP_UPDATED",
      targetType: "workshop",
      targetId: workshop.id,
      metadata: values,
    });
  });
}

// One city's session: date and hours, place, price, seats, group, sale.
export async function updateWorkshopSession(
  adminUserId: string,
  sessionId: string,
  input: z.input<typeof workshopSessionSchema>,
) {
  const values = workshopSessionSchema.parse(input);
  return db.transaction(async (tx) => {
    await assertAdmin(tx, adminUserId);
    const page = await getWorkshop(tx);
    const session = await getSession(tx, page.id, sessionId);
    if (!session) throw new Error("Session introuvable.");
    await tx
      .update(workshops)
      .set({ ...values, updatedAt: sql`now()` })
      .where(eq(workshops.id, session.id));
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "WORKSHOP_UPDATED",
      targetType: "workshop",
      targetId: session.id,
      metadata: values,
    });
  });
}

// Someone who wrote on WhatsApp once the online sale stopped, and paid
// off-site: registered as paid, with the same code as anyone else, worth
// what they really paid. No payments row: no provider was involved.
export async function addWorkshopRegistration(
  adminUserId: string,
  input: z.input<typeof adminWorkshopRegistrationSchema>,
) {
  const values = adminWorkshopRegistrationSchema.parse(input);
  return db.transaction(async (tx) => {
    await assertAdmin(tx, adminUserId);
    const page = await getWorkshop(tx);
    const { workshopId, ...participant } = values;
    // The page's own row (the first session) or one of its sessions.
    const workshop =
      workshopId === page.id ? page : await getSession(tx, page.id, workshopId);
    if (!workshop) throw new Error("Session introuvable.");
    const [registration] = await tx
      .insert(workshopRegistrations)
      .values({
        workshopId: workshop.id,
        ...participant,
        city: workshop.city ?? "",
        status: "PAID",
        amountPaid: values.amount,
        source: "ADMIN",
        accessToken: randomBytes(24).toString("base64url"),
        discountCode: generateDiscountCode(),
        confirmedAt: sql`now()`,
      })
      .returning();
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "WORKSHOP_REGISTRATION_ADDED",
      targetType: "workshop_registration",
      targetId: registration.id,
      metadata: { amount: values.amount, whatsapp: values.whatsapp },
    });
    return registration;
  });
}

// The rest of a seat paid at the door, or by any other way off-site
// (explicit user decision): the seat counts as paid in full, and its code
// comes with it. No payments row: no provider was involved.
export async function markWorkshopBalancePaid(
  adminUserId: string,
  registrationId: string,
) {
  return db.transaction(async (tx) => {
    await assertAdmin(tx, adminUserId);
    const registration = await tx.query.workshopRegistrations.findFirst({
      where: eq(workshopRegistrations.id, registrationId),
    });
    if (!registration || registration.status !== "PAID") {
      throw new Error("Réservation introuvable.");
    }
    const left = registration.amount - registration.amountPaid;
    if (left <= 0) throw new Error("Cette place est déjà entièrement payée.");
    await tx
      .update(workshopRegistrations)
      .set({
        amountPaid: registration.amount,
        discountCode: registration.discountCode ?? generateDiscountCode(),
      })
      .where(
        and(
          eq(workshopRegistrations.id, registrationId),
          eq(workshopRegistrations.amountPaid, registration.amountPaid),
        ),
      );
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "WORKSHOP_BALANCE_RECEIVED",
      targetType: "workshop_registration",
      targetId: registrationId,
      metadata: { amount: left, whatsapp: registration.whatsapp },
    });
  });
}
