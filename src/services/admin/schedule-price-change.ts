import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { parameterVersions } from "@/db/schema/parameter-versions";
import { profiles } from "@/db/schema/profiles";
import { PRICE_KEY, REGULAR_PRICE_KEY } from "@/services/pricing/launch-offer";
import { logAdminAction } from "./audit-log";
import { SUBSCRIPTION_PRICE_MAX, SUBSCRIPTION_PRICE_MIN } from "./input-limits";

const DAY_MS = 24 * 60 * 60 * 1000;

// "Fin du prix de lancement": programs the new subscription price from a
// date, as parameter versions starting in the future — getCurrentParameterValue
// switches to them by itself at that instant (midnight GMT), with no one
// having to do anything. The struck-through "tarif normal" is set to 0 at
// the same instant, so the launch mention disappears with the old price.
// Programming again replaces the previous programming. Never touches the
// versions in force today: the price members pay doesn't change before
// the date.
export async function scheduleSubscriptionPriceChange(
  adminUserId: string,
  input: { newPrice: number; startDate: string },
) {
  const { newPrice, startDate } = input;
  if (
    !Number.isInteger(newPrice) ||
    newPrice < SUBSCRIPTION_PRICE_MIN ||
    newPrice > SUBSCRIPTION_PRICE_MAX
  ) {
    throw new Error(
      `Le nouveau prix doit être compris entre ${SUBSCRIPTION_PRICE_MIN.toLocaleString("fr-FR")} et ${SUBSCRIPTION_PRICE_MAX.toLocaleString("fr-FR")} F.`,
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    throw new Error("Choisissez une date.");
  }
  const effectiveFrom = new Date(`${startDate}T00:00:00Z`);
  const now = Date.now();
  if (Number.isNaN(effectiveFrom.getTime()) || effectiveFrom.getTime() <= now) {
    throw new Error("La date doit être dans le futur.");
  }
  if (effectiveFrom.getTime() > now + 366 * DAY_MS) {
    throw new Error("La date doit être dans moins d'un an.");
  }

  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut modifier un paramètre.");
    }
    // Versions not yet in force: never applied, so replacing them rewrites
    // no history.
    await tx
      .delete(parameterVersions)
      .where(
        and(
          inArray(parameterVersions.parameterKey, [
            PRICE_KEY,
            REGULAR_PRICE_KEY,
          ]),
          sql`${parameterVersions.effectiveFrom} > now()`,
        ),
      );
    await tx.insert(parameterVersions).values([
      {
        parameterKey: PRICE_KEY,
        value: newPrice,
        effectiveFrom,
        createdBy: adminUserId,
      },
      {
        parameterKey: REGULAR_PRICE_KEY,
        value: 0,
        effectiveFrom,
        createdBy: adminUserId,
      },
    ]);
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "PRICE_CHANGE_SCHEDULED",
      targetType: "parameter",
      targetId: PRICE_KEY,
      metadata: { newPrice, effectiveFrom: effectiveFrom.toISOString() },
    });
  });
}

export async function cancelScheduledPriceChange(adminUserId: string) {
  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error("Seul un administrateur peut modifier un paramètre.");
    }
    const removed = await tx
      .delete(parameterVersions)
      .where(
        and(
          inArray(parameterVersions.parameterKey, [
            PRICE_KEY,
            REGULAR_PRICE_KEY,
          ]),
          sql`${parameterVersions.effectiveFrom} > now()`,
        ),
      )
      .returning();
    if (removed.length === 0) {
      throw new Error("Aucun changement de prix n'est programmé.");
    }
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "PRICE_CHANGE_CANCELLED",
      targetType: "parameter",
      targetId: PRICE_KEY,
    });
  });
}
