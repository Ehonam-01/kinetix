import "server-only";
import type { User } from "@supabase/supabase-js";
import {
  findProfileById,
  insertProfileIfMissing,
} from "@/repositories/profiles";
import { registerSchema, usernameSchema } from "@/schemas/auth";

// user_metadata is user-controlled: the anon key is public, so anyone can
// call Supabase's /auth/v1/signup (or auth.updateUser) directly with
// arbitrary metadata, bypassing registerAction's schema entirely. Every
// field is re-validated against the same schema the registration form uses,
// falling back to a safe default instead of trusting it (security audit M3).
export async function ensureProfile(user: User) {
  const existing = await findProfileById(user.id);
  if (existing) return existing;

  const parsedFullName = registerSchema.shape.fullName.safeParse(
    user.user_metadata?.full_name,
  );
  const parsedUsername = usernameSchema.safeParse(user.user_metadata?.username);
  const wantsAmbassador = user.user_metadata?.wants_ambassador === true;

  return insertProfileIfMissing({
    id: user.id,
    fullName: parsedFullName.success ? parsedFullName.data : "",
    username: parsedUsername.success
      ? parsedUsername.data
      : `membre_${user.id.slice(0, 8)}`,
    wantsAmbassador,
  });
}
