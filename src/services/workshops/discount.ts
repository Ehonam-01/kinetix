import "server-only";
import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { workshopRegistrations, workshops } from "@/db/schema/workshops";
import { alertAdmins } from "@/services/notifications/admin-alerts";

// How long a subscription payment holds a code while it waits for
// confirmation: long enough for the phone prompt, short enough that an
// abandoned payment gives the code back.
const RESERVATION_MS = 15 * 60 * 1000;

const INVALID_CODE_MESSAGE = "Ce code est invalide, expiré ou déjà utilisé.";

export function normalizeWorkshopCode(code: string) {
  return code.trim().toUpperCase();
}

// The participant's code takes what they paid for the workshop off their
// subscription, once, until the workshop's discountValidUntil.
function usableCodeWhere(code: string) {
  return and(
    eq(workshopRegistrations.discountCode, normalizeWorkshopCode(code)),
    eq(workshopRegistrations.status, "PAID"),
    isNull(workshopRegistrations.discountUsedAt),
    or(
      isNull(workshopRegistrations.discountReservedUntil),
      lt(workshopRegistrations.discountReservedUntil, sql`now()`),
    ),
    gt(workshops.discountValidUntil, sql`now()`),
  );
}

// True while at least one code can still be spent: the code field stays off
// the subscription page the rest of the year.
export async function isWorkshopDiscountOpen(executor: Executor) {
  const row = await executor.query.workshops.findFirst({
    where: gt(workshops.discountValidUntil, sql`now()`),
  });
  return Boolean(row);
}

// Preview on the subscription page; reserves nothing.
export async function findWorkshopDiscount(executor: Executor, code: string) {
  const [row] = await executor
    .select({ amount: workshopRegistrations.amount })
    .from(workshopRegistrations)
    .innerJoin(workshops, eq(workshops.id, workshopRegistrations.workshopId))
    .where(usableCodeWhere(code));
  return row?.amount ?? null;
}

// Holds the code for a payment about to start, atomically: of two payments
// racing with it, only one gets it. Throws when it can't be used.
export async function reserveWorkshopDiscount(
  executor: Executor,
  code: string,
) {
  const amount = await executor.transaction(async (tx) => {
    const [target] = await tx
      .select({
        id: workshopRegistrations.id,
        amount: workshopRegistrations.amount,
      })
      .from(workshopRegistrations)
      .innerJoin(workshops, eq(workshops.id, workshopRegistrations.workshopId))
      .where(usableCodeWhere(code))
      .for("update", { of: workshopRegistrations });
    if (!target) return null;
    await tx
      .update(workshopRegistrations)
      .set({ discountReservedUntil: new Date(Date.now() + RESERVATION_MS) })
      .where(eq(workshopRegistrations.id, target.id));
    return target.amount;
  });
  if (amount === null) throw new Error(INVALID_CODE_MESSAGE);
  return amount;
}

// The provider refused the payment: nothing will ever confirm it.
export async function releaseWorkshopDiscount(
  executor: Executor,
  code: string,
) {
  await executor
    .update(workshopRegistrations)
    .set({ discountReservedUntil: null })
    .where(
      and(
        eq(workshopRegistrations.discountCode, normalizeWorkshopCode(code)),
        isNull(workshopRegistrations.discountUsedAt),
      ),
    );
}

// The subscription is confirmed (confirm-subscription-payment.ts). The
// member already paid the reduced price, so an expired reservation still
// counts; only a code spent in the meantime is worth an admin's attention.
export async function spendWorkshopDiscount(
  tx: Executor,
  code: string,
  paymentId: string,
) {
  const [spent] = await tx
    .update(workshopRegistrations)
    .set({ discountUsedAt: sql`now()`, discountPaymentId: paymentId })
    .where(
      and(
        eq(workshopRegistrations.discountCode, normalizeWorkshopCode(code)),
        isNull(workshopRegistrations.discountUsedAt),
      ),
    )
    .returning({ id: workshopRegistrations.id });
  if (!spent) {
    alertAdmins(
      `workshop-code-reused:${paymentId}`,
      "Code d'atelier utilisé deux fois",
      [`Code : ${code}`, `Abonnement payé avec : ${paymentId}`],
    );
  }
}
