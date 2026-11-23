import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import type { Executor } from "@/db/executor";
import { profiles } from "@/db/schema/profiles";
import { siteTestimonials } from "@/db/schema/site-testimonials";
import { createClient } from "@/lib/supabase/server";
import { getVideoEmbedUrl } from "@/lib/video-embed";
import { logAdminAction } from "@/services/admin/audit-log";

// Members' testimonials on the homepage (db/schema/site-testimonials.ts),
// managed from /admin/temoignages. Only real ones, entered by an admin.

// The public bucket the admins already upload to (migration 0030's
// policies), in a folder of its own: no new bucket to create.
const BUCKET = "course-thumbnails";
const FOLDER = "site-testimonials";
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
// Raster formats only, never SVG (same reasoning as
// services/lms/upload-course-thumbnail.ts).
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((value) => value || null);

export const siteTestimonialSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, "Indique le prénom.")
    .max(60, "Ce prénom est trop long."),
  city: optionalText(60, "Cette ville est trop longue."),
  courseTitle: optionalText(120, "Ce titre de formation est trop long."),
  quote: z
    .string()
    .trim()
    .min(10, "La citation est trop courte.")
    .max(400, "La citation est trop longue (400 caractères au plus)."),
  videoUrl: z
    .string()
    .trim()
    .refine(
      (value) => !value || getVideoEmbedUrl("YOUTUBE", value),
      "Lien YouTube invalide.",
    )
    .transform((value) => value || null),
});

async function assertAdmin(executor: Executor, adminUserId: string) {
  const admin = await executor.query.profiles.findFirst({
    where: eq(profiles.id, adminUserId),
  });
  if (admin?.role !== "ADMIN") {
    throw new Error("Seul un administrateur peut gérer les témoignages.");
  }
}

export function listSiteTestimonials(
  executor: Executor,
  { publishedOnly }: { publishedOnly: boolean },
) {
  return executor.query.siteTestimonials.findMany({
    where: publishedOnly ? eq(siteTestimonials.isPublished, true) : undefined,
    orderBy: [asc(siteTestimonials.position), asc(siteTestimonials.createdAt)],
  });
}

// The photo, optional: stored in the bucket first, then the row recorded.
export async function addSiteTestimonial(
  adminUserId: string,
  input: z.input<typeof siteTestimonialSchema>,
  photo: File | null,
) {
  const values = siteTestimonialSchema.parse(input);
  await assertAdmin(db, adminUserId);

  let photoUrl: string | null = null;
  let path: string | null = null;
  if (photo) {
    const extension = ALLOWED_TYPES[photo.type];
    if (!extension) {
      throw new Error(
        "Format d'image non supporté (JPEG, PNG ou WebP uniquement).",
      );
    }
    if (photo.size > MAX_SIZE_BYTES) {
      throw new Error("La photo ne doit pas dépasser 5 Mo.");
    }
    path = `${FOLDER}/${crypto.randomUUID()}.${extension}`;
    const supabase = await createClient();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, photo, { contentType: photo.type });
    if (error) {
      throw new Error(`Échec de l'envoi de la photo : ${error.message}`);
    }
    photoUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  return db.transaction(async (tx) => {
    const [last] = await tx
      .select({
        max: sql<number>`coalesce(max(${siteTestimonials.position}), 0)`,
      })
      .from(siteTestimonials);
    const [row] = await tx
      .insert(siteTestimonials)
      .values({ ...values, photoUrl, position: Number(last?.max ?? 0) + 1 })
      .returning();
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "SITE_TESTIMONIAL_ADDED",
      targetType: "site_testimonial",
      targetId: row.id,
      metadata: { path },
    });
    return row;
  });
}

async function findSiteTestimonial(executor: Executor, id: string) {
  const row = await executor.query.siteTestimonials.findFirst({
    where: eq(siteTestimonials.id, id),
  });
  if (!row) throw new Error("Témoignage introuvable.");
  return row;
}

export async function setSiteTestimonialPublished(
  adminUserId: string,
  id: string,
  isPublished: boolean,
) {
  return db.transaction(async (tx) => {
    await assertAdmin(tx, adminUserId);
    const row = await findSiteTestimonial(tx, id);
    await tx
      .update(siteTestimonials)
      .set({ isPublished })
      .where(eq(siteTestimonials.id, row.id));
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "SITE_TESTIMONIAL_UPDATED",
      targetType: "site_testimonial",
      targetId: row.id,
      metadata: { isPublished },
    });
  });
}

// One place up or down: swapped with its neighbour, then all renumbered.
export async function moveSiteTestimonial(
  adminUserId: string,
  id: string,
  direction: "up" | "down",
) {
  return db.transaction(async (tx) => {
    await assertAdmin(tx, adminUserId);
    const row = await findSiteTestimonial(tx, id);
    const all = await listSiteTestimonials(tx, { publishedOnly: false });
    const index = all.findIndex((t) => t.id === row.id);
    const otherIndex = direction === "up" ? index - 1 : index + 1;
    if (!all[otherIndex]) return;
    const order = [...all];
    [order[index], order[otherIndex]] = [order[otherIndex], order[index]];
    for (const [i, t] of order.entries()) {
      await tx
        .update(siteTestimonials)
        .set({ position: i + 1 })
        .where(eq(siteTestimonials.id, t.id));
    }
  });
}

// For good (an admin's own content). The photo stays in the bucket.
export async function deleteSiteTestimonial(adminUserId: string, id: string) {
  return db.transaction(async (tx) => {
    await assertAdmin(tx, adminUserId);
    const row = await findSiteTestimonial(tx, id);
    await tx.delete(siteTestimonials).where(eq(siteTestimonials.id, row.id));
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "SITE_TESTIMONIAL_DELETED",
      targetType: "site_testimonial",
      targetId: row.id,
      metadata: { firstName: row.firstName },
    });
  });
}
