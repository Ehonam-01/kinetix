// Deletes every account created by a seed-real-level2.ts run, reading the
// exact id list from its JSON output — never a broad "delete anything
// matching a pattern" query.
//
// Most tables that reference profiles.id do NOT cascade on delete —
// deliberately, everywhere it's a financial/audit record (payments,
// subscriptions, commission_events, financial_transactions, withdrawals,
// sponsorships.sponsor_id, etc. — see src/db/schema/*.ts): a real
// production system should never silently wipe payment history just
// because a profile row goes away. That means Supabase's
// auth.admin.deleteUser() alone fails with a generic "Database error
// deleting user" the moment any of those rows still reference the
// account. This script clears every such table first (batched, by id
// list), then deletes the auth users — deepest binary-tree depth first,
// since binary_nodes.binary_parent_id is a self-reference with no cascade
// either (positions are immutable by design), so a parent can't be
// deleted while a child's row still points to it.
//
// Run from the project root:
//   node --conditions=react-server --env-file=.env.local --import tsx scripts/cleanup-real-level2.ts <RUN_ID>
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { inArray, or } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs } from "@/db/schema/audit-logs";
import { commissionEvents } from "@/db/schema/commission-events";
import { financialTransactions } from "@/db/schema/financial-transactions";
import { memberRewards } from "@/db/schema/rewards";
import { payments } from "@/db/schema/payments";
import { quizAttempts } from "@/db/schema/quizzes";
import { referralClicks } from "@/db/schema/referral-clicks";
import { refunds } from "@/db/schema/refunds";
import { sales } from "@/db/schema/sales";
import { sponsorships } from "@/db/schema/sponsorships";
import { subscriptionWalletRequests } from "@/db/schema/subscription-wallet-requests";
import { subscriptions } from "@/db/schema/subscriptions";
import { walletTransfers } from "@/db/schema/wallet-transfers";
import { withdrawalRequests } from "@/db/schema/withdrawals";

const runId = process.argv[2];
if (!runId) {
  throw new Error("Usage: cleanup-real-level2.ts <RUN_ID>");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.local).",
  );
}
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function clearNonCascadingReferences(ids: string[]) {
  await db.delete(payments).where(
    or(
      inArray(payments.beneficiaryUserId, ids),
      inArray(payments.payerUserId, ids),
      inArray(payments.grantedByAdminId, ids),
    ),
  );
  await db
    .delete(subscriptions)
    .where(
      or(
        inArray(subscriptions.userId, ids),
        inArray(subscriptions.ambassadorUserId, ids),
      ),
    );
  await db
    .delete(financialTransactions)
    .where(inArray(financialTransactions.userId, ids));
  await db
    .delete(commissionEvents)
    .where(
      or(
        inArray(commissionEvents.beneficiaryUserId, ids),
        inArray(commissionEvents.sourceUserId, ids),
      ),
    );
  await db
    .delete(withdrawalRequests)
    .where(
      or(
        inArray(withdrawalRequests.userId, ids),
        inArray(withdrawalRequests.reviewedBy, ids),
      ),
    );
  await db
    .delete(referralClicks)
    .where(inArray(referralClicks.ambassadorUserId, ids));
  await db
    .delete(subscriptionWalletRequests)
    .where(
      or(
        inArray(subscriptionWalletRequests.buyerUserId, ids),
        inArray(subscriptionWalletRequests.walletUserId, ids),
        inArray(subscriptionWalletRequests.ambassadorUserId, ids),
      ),
    );
  await db
    .delete(walletTransfers)
    .where(
      or(
        inArray(walletTransfers.senderId, ids),
        inArray(walletTransfers.recipientId, ids),
      ),
    );
  await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, ids));
  await db.delete(memberRewards).where(inArray(memberRewards.userId, ids));
  await db.delete(sales).where(inArray(sales.buyerUserId, ids));
  await db.delete(quizAttempts).where(inArray(quizAttempts.userId, ids));
  await db.delete(refunds).where(inArray(refunds.initiatedByAdminId, ids));
  // sponsorships.user_id already cascades from profiles; sponsor_id doesn't
  // — a parent can't be deleted while a child's sponsorship row still
  // names them as sponsor.
  await db
    .delete(sponsorships)
    .where(
      or(inArray(sponsorships.userId, ids), inArray(sponsorships.sponsorId, ids)),
    );
}

async function main() {
  const file = path.join(__dirname, `seed-real-level2.${runId}.json`);
  const { created } = JSON.parse(fs.readFileSync(file, "utf8")) as {
    created: { id: string; username: string; depth: number }[];
  };
  const ids = created.map((m) => m.id);

  console.log(`Clearing non-cascading references for ${ids.length} accounts...`);
  await clearNonCascadingReferences(ids);

  // binary_nodes.binary_parent_id has no ON DELETE CASCADE (positions are
  // meant to be immutable — see db/schema/binary-nodes.ts) — deleting a
  // parent while its children's rows still point to it violates that FK.
  // Deepest first avoids ever hitting that.
  const deletionOrder = [...created].sort((a, b) => b.depth - a.depth);

  console.log(`Deleting ${deletionOrder.length} accounts from run ${runId} (leaves first)...`);
  let failures = 0;
  for (const member of deletionOrder) {
    const { error } = await admin.auth.admin.deleteUser(member.id);
    if (error) {
      failures++;
      console.error(`Failed to delete ${member.username} (${member.id}): ${error.message}`);
    }
  }

  console.log(
    failures === 0
      ? "All accounts deleted. The sponsor's own level/generation progress from this run is NOT reset — see note below."
      : `${failures} account(s) failed to delete — re-run this script to retry.`,
  );
  console.log(
    "\nNote: deleting the fake downline does not roll back the sponsor's own " +
      "member_levels/generation_progress/commission_events/wallet balance — " +
      "those are real ledger rows the app never rewrites retroactively, same " +
      "as a real member leaving would. If you need the sponsor's own state " +
      "reset too, that's a separate, explicit decision — ask before doing it.",
  );
}

main().then(() => process.exit(0));
