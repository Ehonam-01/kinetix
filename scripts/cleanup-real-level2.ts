// Fully undoes a seed-real-level2.ts run: deletes every fake account it
// created AND resets the real sponsor account back to "never simulated"
// (member_levels/generation_progress/commission_events/financial_transactions/
// user_balances), so a fresh seed run starts from a true zero instead of
// stacking on top of stale counters. Reads the exact id list from the
// run's JSON output — never a broad "delete anything matching a pattern"
// query.
//
// Most tables that reference profiles.id do NOT cascade on delete —
// deliberately, everywhere it's a financial/audit record (payments,
// subscriptions, commission_events, financial_transactions, withdrawals,
// sponsorships.sponsor_id, etc. — see src/db/schema/*.ts): a real
// production system should never silently wipe payment history just
// because a profile row goes away. Several of those tables also reference
// each other, not just profiles.id (subscriptions -> payments,
// withdrawal_requests/wallet_transfers -> financial_transactions,
// financial_transactions -> commission_events, refunds -> sales ->
// payments) — deleted here in that dependency order. Some ledger rows
// this run produced belong to the SPONSOR, not a fake account (e.g. a
// DIRECT_SALE commission paid to the sponsor, sourced from a fake
// account's subscription) — since this script resets the sponsor's whole
// ledger anyway, every query below matches fake-account ids OR the
// sponsor id, sidestepping the need to trace which specific rows a
// partial cleanup would need to chase down.
//
// Run from the project root:
//   node --conditions=react-server --env-file=.env.local --import tsx scripts/cleanup-real-level2.ts <RUN_ID>
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { eq, inArray, or } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs } from "@/db/schema/audit-logs";
import { commissionEvents } from "@/db/schema/commission-events";
import { financialTransactions } from "@/db/schema/financial-transactions";
import { generationProgress } from "@/db/schema/generation-progress";
import { memberLevels } from "@/db/schema/member-levels";
import { memberRewards } from "@/db/schema/rewards";
import { payments } from "@/db/schema/payments";
import { quizAttempts } from "@/db/schema/quizzes";
import { referralClicks } from "@/db/schema/referral-clicks";
import { refunds } from "@/db/schema/refunds";
import { sales } from "@/db/schema/sales";
import { sponsorships } from "@/db/schema/sponsorships";
import { subscriptionWalletRequests } from "@/db/schema/subscription-wallet-requests";
import { subscriptions } from "@/db/schema/subscriptions";
import { userBalances } from "@/db/schema/user-balances";
import { walletTransfers } from "@/db/schema/wallet-transfers";
import { withdrawalRequests } from "@/db/schema/withdrawals";
import { unlockLevel } from "@/services/mlm/unlock-level";

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

async function clearLedgerAndReferences(allIds: string[]) {
  // refunds -> sales
  await db.delete(refunds).where(inArray(refunds.initiatedByAdminId, allIds));
  // withdrawal_requests -> financial_transactions
  await db
    .delete(withdrawalRequests)
    .where(
      or(
        inArray(withdrawalRequests.userId, allIds),
        inArray(withdrawalRequests.reviewedBy, allIds),
      ),
    );
  // wallet_transfers -> financial_transactions
  await db
    .delete(walletTransfers)
    .where(
      or(
        inArray(walletTransfers.senderId, allIds),
        inArray(walletTransfers.recipientId, allIds),
      ),
    );
  // subscriptions -> payments, referral_clicks
  await db
    .delete(subscriptions)
    .where(
      or(
        inArray(subscriptions.userId, allIds),
        inArray(subscriptions.ambassadorUserId, allIds),
      ),
    );
  // subscription_wallet_requests -> payments, referral_clicks
  await db
    .delete(subscriptionWalletRequests)
    .where(
      or(
        inArray(subscriptionWalletRequests.buyerUserId, allIds),
        inArray(subscriptionWalletRequests.walletUserId, allIds),
        inArray(subscriptionWalletRequests.ambassadorUserId, allIds),
      ),
    );
  // sales -> payments, referral_clicks (after refunds, which reference sales)
  await db.delete(sales).where(inArray(sales.buyerUserId, allIds));
  // financial_transactions -> commission_events (after withdrawal_requests
  // and wallet_transfers, which reference financial_transactions)
  await db
    .delete(financialTransactions)
    .where(inArray(financialTransactions.userId, allIds));
  // commission_events (after financial_transactions, which references it)
  await db
    .delete(commissionEvents)
    .where(
      or(
        inArray(commissionEvents.beneficiaryUserId, allIds),
        inArray(commissionEvents.sourceUserId, allIds),
      ),
    );
  // payments (after subscriptions, subscription_wallet_requests, sales —
  // everything that references it)
  await db.delete(payments).where(
    or(
      inArray(payments.beneficiaryUserId, allIds),
      inArray(payments.payerUserId, allIds),
      inArray(payments.grantedByAdminId, allIds),
    ),
  );
  // referral_clicks (after subscriptions, subscription_wallet_requests,
  // sales — everything that references it)
  await db
    .delete(referralClicks)
    .where(inArray(referralClicks.ambassadorUserId, allIds));
  // No cross-table dependencies among these — safe in any order.
  await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, allIds));
  await db.delete(memberRewards).where(inArray(memberRewards.userId, allIds));
  await db.delete(quizAttempts).where(inArray(quizAttempts.userId, allIds));
  // sponsorships.user_id already cascades from profiles; sponsor_id doesn't
  // — a parent can't be deleted while a child's sponsorship row still
  // names them as sponsor.
  await db
    .delete(sponsorships)
    .where(
      or(
        inArray(sponsorships.userId, allIds),
        inArray(sponsorships.sponsorId, allIds),
      ),
    );
}

async function resetSponsorProgress(sponsorId: string) {
  await db
    .delete(generationProgress)
    .where(eq(generationProgress.userId, sponsorId));
  await db.delete(memberLevels).where(eq(memberLevels.userId, sponsorId));
  await db.delete(userBalances).where(eq(userBalances.userId, sponsorId));

  // Recreates exactly the state join-program.ts leaves a brand-new
  // ambassador in (Level 1 unlocked, both generations at 0) — the real
  // service function, not a hand-rolled insert, so it can never drift from
  // what an actual join produces.
  await db.transaction((tx) => unlockLevel(tx, sponsorId, 1));
}

async function main() {
  const file = path.join(__dirname, `seed-real-level2.${runId}.json`);
  const { sponsor: sponsorUsername, created } = JSON.parse(
    fs.readFileSync(file, "utf8"),
  ) as {
    sponsor: string;
    created: { id: string; username: string; depth: number }[];
  };

  const sponsorProfile = await db.query.profiles.findFirst({
    where: (t, { eq: eqOp }) => eqOp(t.username, sponsorUsername),
  });
  if (!sponsorProfile) {
    throw new Error(`No profile found for sponsor username "${sponsorUsername}".`);
  }

  const ids = created.map((m) => m.id);
  const allIds = [...ids, sponsorProfile.id];

  console.log(
    `Clearing ledger/references for ${ids.length} fake accounts + sponsor "${sponsorUsername}"...`,
  );
  await clearLedgerAndReferences(allIds);

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

  // Only after every fake account (and their binary_nodes position) is
  // gone: resetting the sponsor first would have unlockLevel's own
  // rattrapage step immediately re-count the still-present fake
  // descendants, undoing the reset before it even finished.
  console.log(`Resetting "${sponsorUsername}"'s own level/generation progress...`);
  await resetSponsorProgress(sponsorProfile.id);

  console.log(
    failures === 0
      ? `All accounts deleted. "${sponsorUsername}" is back to a fresh, never-simulated Level 1 state.`
      : `${failures} account(s) failed to delete — fix those first (re-run this script) before trusting the sponsor reset below, since leftover fake descendants would have skewed unlockLevel's rattrapage.`,
  );
}

main().then(() => process.exit(0));
