import "server-only";
import { desc, eq } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { courses } from "@/db/schema/courses";
import { profiles } from "@/db/schema/profiles";
import { sales } from "@/db/schema/sales";

export type AdminSaleSummary = {
  id: string;
  courseTitle: string;
  buyerUsername: string;
  ambassadorUsername: string | null;
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

  return rows.map((r) => ({
    id: r.id,
    courseTitle: r.courseTitle,
    buyerUsername: r.buyerUsername,
    ambassadorUsername: r.ambassadorUserId
      ? (usernameByAmbassadorId.get(r.ambassadorUserId) ?? null)
      : null,
    pricePaid: r.pricePaid,
    businessVolume: r.businessVolume,
    status: r.status,
    createdAt: r.createdAt,
  }));
}

export type MemberPurchaseSummary = {
  id: string;
  courseTitle: string;
  pricePaid: number;
  status: "CONFIRMED" | "REFUNDED";
  createdAt: Date;
};

// "Mes achats" (section 23 of the master prompt) — a customer's own
// purchase history, available regardless of ambassador status.
export async function listPurchasesForBuyer(
  executor: Executor,
  buyerUserId: string,
): Promise<MemberPurchaseSummary[]> {
  const rows = await executor
    .select({
      id: sales.id,
      courseTitle: courses.title,
      pricePaid: sales.pricePaid,
      status: sales.status,
      createdAt: sales.createdAt,
    })
    .from(sales)
    .innerJoin(courses, eq(courses.id, sales.courseId))
    .where(eq(sales.buyerUserId, buyerUserId))
    .orderBy(desc(sales.createdAt));

  return rows;
}

export type AttributedSaleSummary = {
  id: string;
  courseTitle: string;
  buyerUsername: string;
  businessVolume: number;
  status: "CONFIRMED" | "REFUNDED";
  createdAt: Date;
};

// "Mes ventes" (section 24) — sales an ambassador's own referral link
// produced, distinct from listPurchasesForBuyer (their own purchases) and
// from the commission ledger (dashboard/commissions/page.tsx, which shows
// what was earned, not which sales earned it).
export async function listSalesForAmbassador(
  executor: Executor,
  ambassadorUserId: string,
): Promise<AttributedSaleSummary[]> {
  const rows = await executor
    .select({
      id: sales.id,
      courseTitle: courses.title,
      buyerUsername: profiles.username,
      businessVolume: sales.businessVolume,
      status: sales.status,
      createdAt: sales.createdAt,
    })
    .from(sales)
    .innerJoin(courses, eq(courses.id, sales.courseId))
    .innerJoin(profiles, eq(profiles.id, sales.buyerUserId))
    .where(eq(sales.ambassadorUserId, ambassadorUserId))
    .orderBy(desc(sales.createdAt));

  return rows;
}
