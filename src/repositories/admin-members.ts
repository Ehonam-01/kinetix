import "server-only";
import { desc, inArray } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { memberLevels } from "@/db/schema/member-levels";
import { profiles } from "@/db/schema/profiles";
import { userBalances } from "@/db/schema/user-balances";
import { listAuthEmails } from "./auth-users";

export type MemberListRow = {
  id: string;
  fullName: string;
  email: string | null;
  role: "USER" | "ADMIN";
  status: "PENDING_PAYMENT" | "ACTIVE" | "SUSPENDED" | "DELETED";
  createdAt: Date;
  currentLevelCode: number | null;
  availableBalance: number;
};

// Capped at 200 — an admin listing, not a paginated directory; revisit with
// real pagination if the member base grows past what fits on one screen.
export async function listMembers(
  executor: Executor,
  limit = 200,
): Promise<MemberListRow[]> {
  const allProfiles = await executor.query.profiles.findMany({
    orderBy: desc(profiles.createdAt),
    limit,
  });
  if (allProfiles.length === 0) return [];

  const ids = allProfiles.map((p) => p.id);
  const [emails, levelRows, balanceRows] = await Promise.all([
    listAuthEmails(executor, ids),
    executor.query.memberLevels.findMany({
      where: inArray(memberLevels.userId, ids),
    }),
    executor.query.userBalances.findMany({
      where: inArray(userBalances.userId, ids),
    }),
  ]);

  const emailById = new Map(emails.map((e) => [e.id, e.email]));
  const levelsByUser = new Map<string, number[]>();
  for (const row of levelRows) {
    const list = levelsByUser.get(row.userId) ?? [];
    list.push(row.levelCode);
    levelsByUser.set(row.userId, list);
  }
  const balanceByUser = new Map(
    balanceRows.map((b) => [b.userId, b.availableBalance]),
  );

  return allProfiles.map((p) => ({
    id: p.id,
    fullName: p.fullName,
    email: emailById.get(p.id) ?? null,
    role: p.role,
    status: p.status,
    createdAt: p.createdAt,
    currentLevelCode:
      (levelsByUser.get(p.id) ?? [])
        .slice()
        .sort((a, b) => a - b)
        .at(-1) ?? null,
    availableBalance: balanceByUser.get(p.id) ?? 0,
  }));
}
