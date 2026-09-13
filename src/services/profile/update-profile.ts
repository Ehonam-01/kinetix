import "server-only";
import {
  findProfileByUsername,
  updateProfileFields,
} from "@/repositories/profiles";
import {
  updateProfileSchema,
  type UpdateProfileInput,
} from "@/schemas/profile";

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const { fullName, username, phone, country } =
    updateProfileSchema.parse(input);

  const existing = await findProfileByUsername(username);
  if (existing && existing.id !== userId) {
    return { error: "Ce pseudo est déjà pris.", profile: null };
  }

  const profile = await updateProfileFields(userId, {
    fullName,
    username,
    phone: phone || null,
    country: country || null,
  });

  return { error: null, profile };
}
