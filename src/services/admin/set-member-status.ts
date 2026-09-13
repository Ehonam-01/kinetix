import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { binaryNodes } from "@/db/schema/binary-nodes";
import { profiles } from "@/db/schema/profiles";
import { logAdminAction } from "./audit-log";

// Admin-only, role re-checked inside the transaction (defense in depth,
// same convention as every other admin service). A SUSPENDED profile is
// blocked from the whole /dashboard (src/app/dashboard/layout.tsx hides the
// nav, dashboard/page.tsx shows a fixed "compte suspendu" message) — every
// other status (ACTIVE or PENDING_PAYMENT, i.e. a plain customer under the
// education-first pivot, see MLM_RULES.md) can browse freely.
//
// A PENDING_PAYMENT account is a real, ongoing customer state since Phase
// 11, not a transient "hasn't paid yet" — it can be suspended just like an
// ACTIVE one (the old guard blocking this was a leftover assumption from
// when PENDING_PAYMENT meant "doesn't really exist yet"). Reactivating
// derives the correct status from reality instead of always forcing
// ACTIVE: a plain customer who gets suspended and reactivated must not
// silently become an ambassador. The signal used is a binary_nodes row,
// not ambassador_profiles — the legacy paid flow (activate-registration.ts,
// still intact, no UI left pointing to it since this phase) places someone
// in the tree without ever creating an ambassador_profiles row, so checking
// that instead would incorrectly downgrade a legitimately-activated
// pre-pivot member back to PENDING_PAYMENT.
export async function setMemberStatus(
  adminUserId: string,
  targetUserId: string,
  status: "ACTIVE" | "SUSPENDED",
) {
  if (adminUserId === targetUserId) {
    throw new Error(
      "Un administrateur ne peut pas modifier son propre statut.",
    );
  }

  return db.transaction(async (tx) => {
    const admin = await tx.query.profiles.findFirst({
      where: eq(profiles.id, adminUserId),
    });
    if (admin?.role !== "ADMIN") {
      throw new Error(
        "Seul un administrateur peut modifier le statut d'un membre.",
      );
    }

    const target = await tx.query.profiles.findFirst({
      where: eq(profiles.id, targetUserId),
    });
    if (!target) {
      throw new Error("Membre introuvable.");
    }

    let nextStatus: "ACTIVE" | "SUSPENDED" | "PENDING_PAYMENT" = status;
    if (status === "ACTIVE") {
      const node = await tx.query.binaryNodes.findFirst({
        where: eq(binaryNodes.userId, targetUserId),
      });
      nextStatus = node ? "ACTIVE" : "PENDING_PAYMENT";
    }

    const [updated] = await tx
      .update(profiles)
      .set({ status: nextStatus })
      .where(eq(profiles.id, targetUserId))
      .returning();

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action:
        status === "SUSPENDED" ? "MEMBER_SUSPENDED" : "MEMBER_REACTIVATED",
      targetType: "profile",
      targetId: targetUserId,
      metadata: { previousStatus: target.status, nextStatus },
    });

    return updated;
  });
}
