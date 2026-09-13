import "server-only";
import type { Executor } from "@/db/executor";
import { commissionEvents } from "@/db/schema/commission-events";
import { financialTransactions } from "@/db/schema/financial-transactions";
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

  return event;
}
