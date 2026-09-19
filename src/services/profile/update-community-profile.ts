import "server-only";
import { updateCommunityProfileFields } from "@/repositories/profiles";
import {
  updateCommunityProfileSchema,
  type UpdateCommunityProfileInput,
} from "@/schemas/community-profile";

export async function updateCommunityProfile(
  userId: string,
  input: UpdateCommunityProfileInput,
) {
  const { bio, goal, skills, directoryVisible } =
    updateCommunityProfileSchema.parse(input);

  return updateCommunityProfileFields(userId, {
    bio: bio || null,
    goal: goal || null,
    skills,
    directoryVisible,
  });
}
