import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { courses } from "@/db/schema/courses";
import { profiles } from "@/db/schema/profiles";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/services/admin/audit-log";

const BUCKET = "course-thumbnails";
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

// Raster formats only — no SVG. An SVG can carry embedded <script>/event
// handlers, a known stored-XSS vector for "image" uploads; JPEG/PNG/WebP
// bytes are never executed by a browser, so accepting them carries no
// equivalent risk even without deeper magic-byte validation.
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Admin-only. Uploads through the session-authenticated Supabase client
// (lib/supabase/server.ts), not Drizzle — Storage objects are files, not
// Postgres rows, so this is the one write in the codebase that
// can't go over the direct Postgres connection and does rely on the
// storage.objects RLS policy (migration 0030) for its actual enforcement.
// The role check below runs first regardless, same as every other admin
// service, so the RLS policy is real defense-in-depth, not the only gate.
export async function uploadCourseThumbnail(
  adminUserId: string,
  courseId: string,
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
      "Seul un administrateur peut modifier la miniature d'une formation.",
    );
  }

  const course = await db.query.courses.findFirst({
    where: eq(courses.id, courseId),
  });
  if (!course) {
    throw new Error("Formation introuvable.");
  }

  const path = `${courseId}/${crypto.randomUUID()}.${extension}`;
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
    .update(courses)
    .set({ thumbnailUrl: publicUrl })
    .where(eq(courses.id, courseId));

  await logAdminAction(db, {
    actorUserId: adminUserId,
    action: "COURSE_THUMBNAIL_UPDATED",
    targetType: "course",
    targetId: courseId,
    metadata: { path },
  });

  return publicUrl;
}
