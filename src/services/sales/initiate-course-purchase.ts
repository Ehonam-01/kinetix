import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { courses } from "@/db/schema/courses";
import { payments } from "@/db/schema/payments";
import { sales } from "@/db/schema/sales";
import { resolveAttribution } from "@/services/attribution/resolve-referral";
import { monerooProvider } from "@/services/payments/moneroo";

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

// Entry point for buying a course by mobile money — mirrors
// initiate-registration-payment.ts closely, but the amount comes from the
// course row itself, not a parameter_versions key: price/businessVolume are
// two distinct per-course values (section 7 of the master prompt), never a
// single global price. Confirmation only ever happens later, via the
// signed webhook (see confirm-course-purchase.ts and
// process-webhook-event.ts's purpose branch) — this function never grants
// access itself, same non-negotiable rule as the registration flow.
export async function initiateCoursePurchase(input: {
  buyerUserId: string;
  courseId: string;
  email: string;
  fullName: string;
  returnUrl: string;
  // Read from the visitor's cookie by the caller (a Server Action — see
  // app/dashboard/courses/[courseId]/purchase-actions.ts), same convention
  // as returnUrl being resolved from headers() by the caller rather than
  // this function reaching into next/headers itself. Resolved to an
  // ambassador now, while a request context still exists — the webhook
  // that later confirms this payment runs with no cookies at all (Moneroo's
  // server calls it, not the buyer's browser), so this is the only moment
  // attribution can be captured.
  visitorToken?: string;
}) {
  const course = await db.query.courses.findFirst({
    where: eq(courses.id, input.courseId),
  });
  if (!course) {
    throw new Error("Formation introuvable.");
  }
  if (course.price == null) {
    throw new Error("Cette formation n'est pas encore disponible à l'achat.");
  }

  const existingSale = await db.query.sales.findFirst({
    where: and(
      eq(sales.buyerUserId, input.buyerUserId),
      eq(sales.courseId, input.courseId),
      eq(sales.status, "CONFIRMED"),
    ),
  });
  if (existingSale) {
    throw new Error("Vous avez déjà accès à cette formation.");
  }

  const attribution = await resolveAttribution(input.visitorToken);

  const idempotencyKey = `COURSE_PURCHASE:${input.buyerUserId}:${input.courseId}:${randomUUID()}`;
  const { firstName, lastName } = splitFullName(input.fullName);

  const intent = await monerooProvider.createPayment({
    amount: course.price,
    description: `Achat de la formation : ${course.title}`,
    customer: { email: input.email, firstName, lastName },
    returnUrl: input.returnUrl,
    idempotencyKey,
    metadata: {
      beneficiary_user_id: input.buyerUserId,
      course_id: input.courseId,
    },
  });

  const [payment] = await db
    .insert(payments)
    .values({
      beneficiaryUserId: input.buyerUserId,
      purpose: "COURSE_PURCHASE",
      method: "MOBILE_MONEY",
      amount: course.price,
      provider: "MONEROO",
      providerReference: intent.providerReference,
      idempotencyKey,
      status: "PENDING",
      // The only place confirm-course-purchase.ts can recover which course
      // (and, if any, which ambassador) this payment was for — payments
      // has no courseId/ambassadorUserId columns of its own (it stays
      // purpose-agnostic, reused by REGISTRATION too).
      metadata: {
        courseId: input.courseId,
        ambassadorUserId: attribution?.ambassadorUserId ?? null,
        attributionId: attribution?.attributionId ?? null,
      },
    })
    .returning();

  return { payment, checkoutUrl: intent.checkoutUrl };
}
