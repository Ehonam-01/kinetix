import "server-only";
import { and, eq } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { installmentPlans } from "@/db/schema/installment-plans";

// A member paying in 3 times (lib/split-payment.ts) already has their
// subscription, opened by the first tranche: until the rest is paid, they
// settle it — never pay a second, full subscription on top (that would
// start another year and close the plan without its commission).
export function findOpenSplitPlan(executor: Executor, userId: string) {
  return executor.query.installmentPlans.findFirst({
    where: and(
      eq(installmentPlans.userId, userId),
      eq(installmentPlans.status, "OPEN"),
      eq(installmentPlans.split, true),
    ),
  });
}

export async function assertNoOpenSplitPlan(
  executor: Executor,
  userId: string,
) {
  if (await findOpenSplitPlan(executor, userId)) {
    throw new Error(
      "Tu paies déjà ton abonnement en 3 fois : règle le reste depuis la page Mon abonnement.",
    );
  }
}
