import "server-only";
import { eq } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { sponsorships } from "@/db/schema/sponsorships";

// Idempotent and append-only: a member's sponsor is fixed the first time
// it's recorded (unique index on user_id) and never reassigned here. Takes
// an Executor rather than opening its own transaction (like
// placeMember/createRootNode, see ARCHITECTURE.md "Généalogie") so callers
// that need it atomic alongside other writes — services/ambassador/join-program.ts —
// can run it inside their own db.transaction(tx => ...) without the nested-
// transaction bug documented in DATABASE.md Phase 5. auth/callback/route.ts,
// the original caller, passes the top-level db — functionally identical to
// before this was parameterized.
export async function assignSponsor(
  executor: Executor,
  userId: string,
  sponsorId: string,
) {
  if (userId === sponsorId) {
    throw new Error("Un membre ne peut pas être son propre parrain.");
  }

  const [created] = await executor
    .insert(sponsorships)
    .values({ userId, sponsorId })
    .onConflictDoNothing({ target: sponsorships.userId })
    .returning();

  if (created) return created;

  return executor.query.sponsorships.findFirst({
    where: eq(sponsorships.userId, userId),
  });
}
