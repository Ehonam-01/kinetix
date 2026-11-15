import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { commissionEvents } from "@/db/schema/commission-events";
import { courses } from "@/db/schema/courses";
import { profiles } from "@/db/schema/profiles";
import { sales } from "@/db/schema/sales";

export type AdminSaleSummary = {
  id: string;
  courseTitle: string;
  buyerUsername: string;
  buyerFullName: string;
  ambassadorUsername: string | null;
  // The sponsor's commission on it (services/lms/course-purchase.ts), null
  // when none was paid.
  commission: number | null;
  pricePaid: number;
  businessVolume: number;
  status: "CONFIRMED" | "REFUNDED";
  createdAt: Date;
};

// Admin listing (admin/sales/page.tsx) — no admin UI existed for sales at
// all before this phase (section 25 of the master prompt lists "Ventes" as
// a required admin section), most recent first.
export async function listSalesForAdmin(
  executor: Executor,
): Promise<AdminSaleSummary[]> {
  const rows = await executor
    .select({
      id: sales.id,
      courseTitle: courses.title,
      buyerUsername: profiles.username,
      buyerFullName: profiles.fullName,
      pricePaid: sales.pricePaid,
      businessVolume: sales.businessVolume,
      status: sales.status,
      createdAt: sales.createdAt,
      ambassadorUserId: sales.ambassadorUserId,
    })
    .from(sales)
    .innerJoin(courses, eq(courses.id, sales.courseId))
    .innerJoin(profiles, eq(profiles.id, sales.buyerUserId))
    .orderBy(desc(sales.createdAt));

  const ambassadorIds = [
    ...new Set(
      rows
        .map((r) => r.ambassadorUserId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const ambassadors = ambassadorIds.length
    ? await executor.query.profiles.findMany({
        where: (p, { inArray }) => inArray(p.id, ambassadorIds),
      })
    : [];
  const usernameByAmbassadorId = new Map(
    ambassadors.map((a) => [a.id, a.username]),
  );

  const commissionBySale = await commissionsBySale(
    executor,
    rows.map((r) => r.id),
  );

  return rows.map((r) => ({
    id: r.id,
    courseTitle: r.courseTitle,
    buyerUsername: r.buyerUsername,
    buyerFullName: r.buyerFullName,
    commission: commissionBySale.get(r.id) ?? null,
    ambassadorUsername: r.ambassadorUserId
      ? (usernameByAmbassadorId.get(r.ambassadorUserId) ?? null)
      : null,
    pricePaid: r.pricePaid,
    businessVolume: r.businessVolume,
    status: r.status,
    createdAt: r.createdAt,
  }));
}

// The commission each sale paid its sponsor, by sale id: its dedupe key is
// DIRECT_SALE:<sale id> (services/lms/course-purchase.ts).
async function commissionsBySale(executor: Executor, saleIds: string[]) {
  if (saleIds.length === 0) return new Map<string, number>();
  const rows = await executor
    .select({
      dedupeKey: commissionEvents.dedupeKey,
      amount: commissionEvents.amount,
    })
    .from(commissionEvents)
    .where(
      inArray(
        commissionEvents.dedupeKey,
        saleIds.map((id) => `DIRECT_SALE:${id}`),
      ),
    );
  return new Map(
    rows.map((r) => [r.dedupeKey.slice("DIRECT_SALE:".length), r.amount]),
  );
}

// The courses sold on their own through this sponsor (their commissions
// page), most recent first.
export async function listCourseSalesForAmbassador(
  executor: Executor,
  ambassadorUserId: string,
) {
  const rows = await executor
    .select({
      id: sales.id,
      courseTitle: courses.title,
      buyerUsername: profiles.username,
      pricePaid: sales.pricePaid,
      status: sales.status,
      createdAt: sales.createdAt,
    })
    .from(sales)
    .innerJoin(courses, eq(courses.id, sales.courseId))
    .innerJoin(profiles, eq(profiles.id, sales.buyerUserId))
    .where(eq(sales.ambassadorUserId, ambassadorUserId))
    .orderBy(desc(sales.createdAt));
  const commissionBySale = await commissionsBySale(
    executor,
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({
    ...r,
    commission: commissionBySale.get(r.id) ?? null,
  }));
}
