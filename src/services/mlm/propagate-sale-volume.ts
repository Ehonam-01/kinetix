import "server-only";
import { and, eq } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { generationProgress } from "@/db/schema/generation-progress";
import {
  findAncestors,
  findBinaryNodeByUserId,
} from "@/repositories/binary-nodes";
import { incrementGenerationBv } from "./unlock-level";

// Called by services/sales/confirm-course-purchase.ts whenever a confirmed
// sale has an ambassador attributed: the sale's Business Volume propagates
// up to 3 generations up the ambassador's own ancestor chain (same
// ltree walk as unlock-level.ts's propagation half, findAncestors), exactly
// like a descendant reaching a level does for headcount — just triggered
// by a sale instead. A single relative generation can match several of an
// ancestor's unlocked levels at once (the same physical tree position is
// "generation 1" for level 2, level 3, level 4 and level 5 simultaneously,
// see MLM_RULES.md), so every generation_progress row at that relative
// depth is credited, not just one.
//
// Bidirectional on purpose: services/sales/refund-sale.ts calls this again
// with a negative bvAmount to correct a refunded sale's contribution.
// incrementGenerationBv's completion check is a no-op for an already-
// COMPLETED row regardless of sign — a refund lowers bvTotal for future
// reference but never un-completes a generation or claws back a
// generation-level commission already paid from cumulative BV across
// possibly several sales (see ARCHITECTURE.md for why that's out of scope
// here — only the sale's own direct-sale commission is reversed 1:1).
export async function propagateSaleVolume(
  tx: Executor,
  ambassadorUserId: string,
  bvAmount: number,
) {
  if (bvAmount === 0) return;

  const node = await findBinaryNodeByUserId(tx, ambassadorUserId);
  if (!node) return;

  const ancestors = await findAncestors(tx, node.path, 3);
  for (const ancestor of ancestors) {
    const rows = await tx.query.generationProgress.findMany({
      where: and(
        eq(generationProgress.userId, ancestor.userId),
        eq(generationProgress.generation, ancestor.relativeGeneration),
      ),
    });
    for (const row of rows) {
      await incrementGenerationBv(
        tx,
        ancestor.userId,
        row.levelCode,
        row.generation,
        bvAmount,
      );
    }
  }
}
