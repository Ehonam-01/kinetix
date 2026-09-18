// Deletes every account created by a seed-real-level2.ts run, reading the
// exact id list from its JSON output — never a broad "delete anything
// matching a pattern" query. Deleting the auth user cascades (onDelete:
// "cascade" on profiles.id -> auth.users.id, and from profiles to every
// MLM table below it) so one call per account is enough to remove their
// profile, ambassador_profiles row, binary_nodes position, subscriptions,
// payments, commission_events and financial_transactions too.
//
// Run from the project root:
//   node --conditions=react-server --env-file=.env.local --import tsx scripts/cleanup-real-level2.ts <RUN_ID>
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const runId = process.argv[2];
if (!runId) {
  throw new Error("Usage: cleanup-real-level2.ts <RUN_ID>");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.local).",
  );
}
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const file = path.join(__dirname, `seed-real-level2.${runId}.json`);
  const { created } = JSON.parse(fs.readFileSync(file, "utf8")) as {
    created: { id: string; username: string }[];
  };

  console.log(`Deleting ${created.length} accounts from run ${runId}...`);
  let failures = 0;
  for (const member of created) {
    const { error } = await admin.auth.admin.deleteUser(member.id);
    if (error) {
      failures++;
      console.error(`Failed to delete ${member.username} (${member.id}): ${error.message}`);
    }
  }

  console.log(
    failures === 0
      ? "All accounts deleted. The sponsor's own level/generation progress from this run is NOT reset — see note below."
      : `${failures} account(s) failed to delete — re-run this script to retry.`,
  );
  console.log(
    "\nNote: deleting the fake downline does not roll back the sponsor's own " +
      "member_levels/generation_progress/commission_events/wallet balance — " +
      "those are real ledger rows the app never rewrites retroactively, same " +
      "as a real member leaving would. If you need the sponsor's own state " +
      "reset too, that's a separate, explicit decision — ask before doing it.",
  );
}

main().then(() => process.exit(0));
