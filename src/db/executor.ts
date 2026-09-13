import { db } from "./client";

// A repository/service function typed with Executor can run either against
// the top-level db or inside db.transaction(tx => ...) — derived from the
// transaction callback's own parameter type so it can't drift from
// Drizzle's actual signature.
export type Executor =
  typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
