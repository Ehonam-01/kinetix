import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles } from "@/db/schema/profiles";
import { rewards } from "@/db/schema/rewards";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "./audit-log";

const BUCKET = "reward-images";
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

// Raster formats only — no SVG, same reasoning as
// services/lms/upload-course-thumbnail.ts (an SVG can carry embedded
// <script>/event handlers, a known stored-XSS vector for "image" uploads).
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Admin-only. Uploads through the session-authenticated Supabase client
// (lib/supabase/server.ts), not Drizzle — Storage objects are files, not
// Postgres rows, so this can't go over the direct Postgres connection and
// relies on the storage.objects RLS policy (migration 0041) for its
// actual enforcement. The role check below runs first regardless, same as
// upload-course-thumbnail.ts.
export async function uploadRewardImage(
  adminUserId: string,
  rewardId: string,
  file: File,
) {
  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    throw new Error(
      "Format d'image non supporté (JPEG, PNG ou WebP uniquement).",
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("L'image ne doit pas dépasser 5 Mo.");
  }

  const admin = await db.query.profiles.findFirst({
    where: eq(profiles.id, adminUserId),
  });
  if (admin?.role !== "ADMIN") {
    throw new Error(
      "Seul un administrateur peut modifier l'image d'une récompense.",
    );
  }

  const reward = await db.query.rewards.findFirst({
    where: eq(rewards.id, rewardId),
  });
  if (!reward) {
    throw new Error("Récompense introuvable.");
  }

  const path = `${rewardId}/${crypto.randomUUID()}.${extension}`;
  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type });
  if (uploadError) {
    throw new Error(`Échec de l'envoi de l'image : ${uploadError.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  await db
    .update(rewards)
    .set({ imageUrl: publicUrl })
    .where(eq(rewards.id, rewardId));

  await logAdminAction(db, {
    actorUserId: adminUserId,
    action: "REWARD_IMAGE_UPDATED",
    targetType: "reward",
    targetId: rewardId,
    metadata: { path },
  });

  return publicUrl;
}
