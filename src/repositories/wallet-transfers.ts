import "server-only";
import { desc, eq, inArray, or } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { profiles } from "@/db/schema/profiles";
import { walletTransfers } from "@/db/schema/wallet-transfers";

export function findTransferById(executor: Executor, id: string) {
  return executor.query.walletTransfers.findFirst({
    where: eq(walletTransfers.id, id),
  });
}

// Both directions for a given member (sent + received), newest first — used
// by the member-facing history and, unfiltered, by the admin oversight page.
export type TransferListRow = {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  amount: number;
  status: "PENDING_OTP" | "CONFIRMED" | "EXPIRED";
  createdAt: Date;
  confirmedAt: Date | null;
};

export async function listTransfers(
  executor: Executor,
  limit = 200,
): Promise<TransferListRow[]> {
  const sender = profiles;
  const rows = await executor
    .select({
      id: walletTransfers.id,
      senderId: walletTransfers.senderId,
      senderName: sender.fullName,
      recipientId: walletTransfers.recipientId,
      amount: walletTransfers.amount,
      status: walletTransfers.status,
      createdAt: walletTransfers.createdAt,
      confirmedAt: walletTransfers.confirmedAt,
    })
    .from(walletTransfers)
    .innerJoin(sender, eq(sender.id, walletTransfers.senderId))
    .orderBy(desc(walletTransfers.createdAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const recipientIds = [...new Set(rows.map((r) => r.recipientId))];
  const recipients = await executor.query.profiles.findMany({
    where: inArray(profiles.id, recipientIds),
  });
  const recipientNameById = new Map(recipients.map((r) => [r.id, r.fullName]));

  return rows.map((r) => ({
    ...r,
    recipientName: recipientNameById.get(r.recipientId) ?? "?",
  }));
}

export function listTransfersForUser(
  executor: Executor,
  userId: string,
  limit = 50,
) {
  return executor.query.walletTransfers.findMany({
    where: or(
      eq(walletTransfers.senderId, userId),
      eq(walletTransfers.recipientId, userId),
    ),
    orderBy: desc(walletTransfers.createdAt),
    limit,
  });
}
