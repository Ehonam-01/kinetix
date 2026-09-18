import "server-only";
import { and, desc, eq, isNull, lte, or, sql } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { parameterVersions } from "@/db/schema/parameter-versions";

// The current, effective value of a versioned financial parameter — never
// a live-mutable "commission_rules" row, so a rate change can never alter
// what a past commission_event already snapshotted (section 29/43).
export async function getCurrentParameterValue(
  executor: Executor,
  key: string,
): Promise<number> {
  const row = await executor.query.parameterVersions.findFirst({
    where: and(
      eq(parameterVersions.parameterKey, key),
      lte(parameterVersions.effectiveFrom, sql`now()`),
      or(
        isNull(parameterVersions.effectiveTo),
        sql`${parameterVersions.effectiveTo} > now()`,
      ),
    ),
    orderBy: desc(parameterVersions.effectiveFrom),
  });

  if (!row) {
    throw new Error(`Paramètre financier manquant ou inactif : ${key}`);
  }

  return row.value;
}

// The same lookup, but null instead of throwing when unset — for the one
// caller (unlock-level.ts's legacy commission.level.N fallback) where
// "not configured yet" is a legitimate, expected state to handle
// gracefully, not a startup misconfiguration to fail loudly on. Every
// other caller wants the throwing version: a missing
// subscription.price_in_cfa or bv.value_in_cfa should never be silently
// treated as zero.
export async function getCurrentParameterValueOrNull(
  executor: Executor,
  key: string,
): Promise<number | null> {
  const row = await executor.query.parameterVersions.findFirst({
    where: and(
      eq(parameterVersions.parameterKey, key),
      lte(parameterVersions.effectiveFrom, sql`now()`),
      or(
        isNull(parameterVersions.effectiveTo),
        sql`${parameterVersions.effectiveTo} > now()`,
      ),
    ),
    orderBy: desc(parameterVersions.effectiveFrom),
  });

  return row?.value ?? null;
}

// One row per distinct parameter_key — whichever is currently effective —
// for the admin parameters page. Small, fixed set of keys (7 today), so a
// single findMany + in-memory grouping is simpler than a per-key query.
export async function listCurrentParameters(executor: Executor) {
  const now = new Date();
  const rows = await executor.query.parameterVersions.findMany({
    where: lte(parameterVersions.effectiveFrom, sql`now()`),
    orderBy: desc(parameterVersions.effectiveFrom),
  });

  const currentByKey = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (row.effectiveTo !== null && row.effectiveTo <= now) continue;
    if (!currentByKey.has(row.parameterKey)) {
      currentByKey.set(row.parameterKey, row);
    }
  }

  return [...currentByKey.values()].sort((a, b) =>
    a.parameterKey.localeCompare(b.parameterKey),
  );
}
