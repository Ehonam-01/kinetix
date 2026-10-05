import "server-only";
import { eq } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { commissionEvents } from "@/db/schema/commission-events";
import { financialTransactions } from "@/db/schema/financial-transactions";
import { profiles } from "@/db/schema/profiles";
import { hasActiveSubscription } from "@/repositories/subscriptions";
import { scheduleCommissionEmails } from "@/services/notifications/commission-emails";
import { creditBalance } from "./credit-balance";

type CommissionInput = {
  beneficiaryUserId: string;
  sourceUserId?: string;
  type:
    | "DIRECT"
    | "LEVEL_1_BONUS"
    | "LEVEL_COMMISSION"
    | "DIRECT_SALE"
    | "GENERATION";
  levelCode?: number;
  generation?: number;
  amount: number;
  // The idempotency guard (section 15) — callers derive this deterministically
  // from the event's identity, e.g. `LEVEL_COMMISSION:${userId}:${level}:${gen}`.
  dedupeKey: string;
  // Free-form traceability (section 32 of the master prompt — a commission
  // must be able to point back to the sale/rule that produced it), written
  // straight to financial_transactions.metadata. commission_events itself
  // gains no new columns for this — the ledger row is where this detail
  // lives, same as wallet_transfers already does.
  metadata?: Record<string, unknown>;
};

const LEDGER_TYPE = {
  DIRECT: "DIRECT_COMMISSION",
  LEVEL_1_BONUS: "LEVEL_1_BONUS",
  LEVEL_COMMISSION: "LEVEL_COMMISSION",
  DIRECT_SALE: "DIRECT_SALE_COMMISSION",
  GENERATION: "GENERATION_COMMISSION",
} as const;

// Pays a commission at most once per dedupe_key: creates the commission_event
// (the idempotency gate), then the ledger row, then updates the cached
// balance — all three or none, since callers always run this inside a
// transaction. Returns null (no-op) if this exact event was already paid.
export async function createCommissionEvent(
  executor: Executor,
  input: CommissionInput,
) {
  // A member who completed the top level (level 4 since migration 0055 —
  // "ancêtre", profiles.became_ancestor_at set by completeLevel) has
  // graduated out of the earning structure — no further commission of any
  // kind, from here on, regardless of type or source. That's all it
  // changes: the account, the balance and course access stay governed by
  // the subscription like any member's (scripts/four-level-plan.test.ts). Checked first, before the dedupe insert, so a blocked event
  // never occupies its dedupe_key (an admin fixing a misconfigured
  // ancestor flag later can still have it paid retroactively).
  const beneficiary = await executor.query.profiles.findFirst({
    where: eq(profiles.id, input.beneficiaryUserId),
    columns: { becameAncestorAt: true, role: true },
  });
  if (beneficiary?.becameAncestorAt) return null;

  // Only a member whose subscription is still valid earns — the paid
  // period plus the grace period after it (hasActiveSubscription). Past
  // that, the account is inactive and the commission is lost for good
  // (explicit user decision): nothing is recorded, and nothing re-triggers
  // it later — a generation completes once, a direct sale is paid on the
  // buyer's first subscription only. A lapsed member still counts in their
  // sponsor's generations; only their own earnings stop. Admins are exempt,
  // same convention as every other subscription gate.
  if (
    beneficiary?.role !== "ADMIN" &&
    !(await hasActiveSubscription(executor, input.beneficiaryUserId))
  ) {
    return null;
  }

  const [event] = await executor
    .insert(commissionEvents)
    .values({
      beneficiaryUserId: input.beneficiaryUserId,
      sourceUserId: input.sourceUserId,
      type: input.type,
      levelCode: input.levelCode,
      generation: input.generation,
      amount: input.amount,
      dedupeKey: input.dedupeKey,
    })
    .onConflictDoNothing({ target: commissionEvents.dedupeKey })
    .returning();

  if (!event) return null;

  await executor.insert(financialTransactions).values({
    userId: input.beneficiaryUserId,
    type: LEDGER_TYPE[input.type],
    amount: input.amount,
    reference: event.id,
    relatedLevel: input.levelCode,
    relatedGeneration: input.generation,
    commissionEventId: event.id,
    metadata: input.metadata,
  });

  await creditBalance(executor, input.beneficiaryUserId, input.amount);

  // "Félicitations, nouveau filleul" — sent once this transaction is
  // committed.
  if (input.type === "DIRECT_SALE") scheduleCommissionEmails();

  return event;
}
