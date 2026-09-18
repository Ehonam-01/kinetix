import "server-only";
import type { User } from "@supabase/supabase-js";
import {
  findProfileById,
  insertProfileIfMissing,
} from "@/repositories/profiles";

export async function ensureProfile(user: User) {
  const existing = await findProfileById(user.id);
  if (existing) return existing;

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "";
  const username =
    typeof user.user_metadata?.username === "string"
      ? user.user_metadata.username
      : `membre_${user.id.slice(0, 8)}`;
  const wantsAmbassador = user.user_metadata?.wants_ambassador === true;

  return insertProfileIfMissing({
    id: user.id,
    fullName,
    username,
    wantsAmbassador,
  });
}
