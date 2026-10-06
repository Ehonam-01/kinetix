import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { installmentPlans } from "@/db/schema/installment-plans";
import { computeWithdrawalFee } from "@/lib/withdrawal-fee";
import { getWithdrawalFeeSettings } from "@/repositories/withdrawals";

// The installment plan is for a first subscription only (explicit user
// decision: no renewal by cagnotte). When a member gets their subscription
// some other way while a plan is still open — paid in full, SasPay, the
// outside shop activated by an admin — that plan must never be completed
// later, or it would pay for a renewal. Called by
// confirm-subscription-payment.ts in the same transaction:
// - nothing paid yet: the plan is simply removed;
// - deposits already paid: the plan is closed like an expired one and
//   refunded minus the withdrawal fees, through admin → Cagnottes; a
//   deposit landing afterwards joins that refund
//   (installments.ts's applyInstallmentDeposit).
export async function closeOpenInstallmentPlan(tx: Executor, userId: string) {
  const [plan] = await tx
    .select()
    .from(installmentPlans)
    .where(
      and(
        eq(installmentPlans.userId, userId),
        eq(installmentPlans.status, "OPEN"),
      ),
    )
    .for("update");
  if (!plan) return;

  if (plan.paidAmount === 0) {
    await tx.delete(installmentPlans).where(eq(installmentPlans.id, plan.id));
    return;
  }

  const fee = computeWithdrawalFee(
    plan.paidAmount,
    await getWithdrawalFeeSettings(tx),
  ).fee;
  const refundFee = Math.min(fee, plan.paidAmount);
  await tx
    .update(installmentPlans)
    .set({
      status: "EXPIRED",
      expiredAt: sql`now()`,
      refundFee,
      refundAmount: plan.paidAmount - refundFee,
    })
    .where(eq(installmentPlans.id, plan.id));
}
