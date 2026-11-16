import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import type { Executor } from "@/db/executor";
import { profiles } from "@/db/schema/profiles";
import { workshopTestimonials } from "@/db/schema/workshops";
import { createClient } from "@/lib/supabase/server";
import { getWorkshop } from "@/repositories/workshops";
import { logAdminAction } from "@/services/admin/audit-log";

// The participants' testimonials on the workshop's sales page (explicit
// user decision: written reviews and screenshots of messages received,
// managed from /admin/atelier). Only real ones, entered by an admin.

// The public bucket the admins already upload to (migration 0030's
// policies), in a folder of its own: no new bucket to create.
const BUCKET = "course-thumbnails";
const FOLDER = "workshop-testimonials";
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

export const textTestimonialSchema = z.object({
  authorName: z
    .string()
    .trim()
    .min(2, "Indique le nom du participant.")
    .max(80, "Ce nom est trop long."),
  authorDetail: optionalText(80, "Ce détail est trop long."),
  body: z
    .string()
    .trim()
    .min(10, "Le témoignage est trop court.")
    .max(1200, "Le témoignage est trop long (1 200 caractères au plus)."),
});

const imageCaptionSchema = z.object({
  authorName: optionalText(80, "Ce nom est trop long."),
  authorDetail: optionalText(80, "Ce détail est trop long."),
});

async function assertAdmin(executor: Executor, adminUserId: string) {
  const admin = await executor.query.profiles.findFirst({
    where: eq(profiles.id, adminUserId),
  });
  if (admin?.role !== "ADMIN") {
    throw new Error("Seul un administrateur peut gérer les témoignages.");
  }
}

// After the last one.
async function nextPosition(executor: Executor, workshopId: string) {
  const [row] = await executor
    .select({
      max: sql<number>`coalesce(max(${workshopTestimonials.position}), 0)`,
    })
    .from(workshopTestimonials)
    .where(eq(workshopTestimonials.workshopId, workshopId));
  return Number(row?.max ?? 0) + 1;
}

export function listTestimonials(
  executor: Executor,
  workshopId: string,
  { publishedOnly }: { publishedOnly: boolean },
) {
  return executor.query.workshopTestimonials.findMany({
    where: publishedOnly
      ? and(
          eq(workshopTestimonials.workshopId, workshopId),
          eq(workshopTestimonials.isPublished, true),
        )
      : eq(workshopTestimonials.workshopId, workshopId),
    orderBy: [
      asc(workshopTestimonials.position),
      asc(workshopTestimonials.createdAt),
    ],
  });
}

export async function addTextTestimonial(
  adminUserId: string,
  input: z.input<typeof textTestimonialSchema>,
) {
  const values = textTestimonialSchema.parse(input);
  return db.transaction(async (tx) => {
    await assertAdmin(tx, adminUserId);
    const page = await getWorkshop(tx);
    const [row] = await tx
      .insert(workshopTestimonials)
      .values({
        workshopId: page.id,
        kind: "TEXT",
        ...values,
        position: await nextPosition(tx, page.id),
      })
      .returning();
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "WORKSHOP_TESTIMONIAL_ADDED",
      targetType: "workshop_testimonial",
      targetId: row.id,
      metadata: { kind: "TEXT" },
    });
    return row;
  });
}

// A screenshot of a message received: stored in the bucket, then recorded.
export async function addImageTestimonial(
  adminUserId: string,
  file: File,
  input: z.input<typeof imageCaptionSchema>,
) {
  const caption = imageCaptionSchema.parse(input);
  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    throw new Error(
      "Format d'image non supporté (JPEG, PNG ou WebP uniquement).",
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("L'image ne doit pas dépasser 5 Mo.");
  }
  await assertAdmin(db, adminUserId);

  const path = `${FOLDER}/${crypto.randomUUID()}.${extension}`;
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type });
  if (error) throw new Error(`Échec de l'envoi de l'image : ${error.message}`);
  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return db.transaction(async (tx) => {
    const page = await getWorkshop(tx);
    const [row] = await tx
      .insert(workshopTestimonials)
      .values({
        workshopId: page.id,
        kind: "IMAGE",
        ...caption,
        imageUrl: publicUrl,
        position: await nextPosition(tx, page.id),
      })
      .returning();
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "WORKSHOP_TESTIMONIAL_ADDED",
      targetType: "workshop_testimonial",
      targetId: row.id,
      metadata: { kind: "IMAGE", path },
    });
    return row;
  });
}

async function findTestimonial(executor: Executor, id: string) {
  const page = await getWorkshop(executor);
  const row = await executor.query.workshopTestimonials.findFirst({
    where: and(
      eq(workshopTestimonials.id, id),
      eq(workshopTestimonials.workshopId, page.id),
    ),
  });
  if (!row) throw new Error("Témoignage introuvable.");
  return row;
}

export async function setTestimonialPublished(
  adminUserId: string,
  id: string,
  isPublished: boolean,
) {
  return db.transaction(async (tx) => {
    await assertAdmin(tx, adminUserId);
    const row = await findTestimonial(tx, id);
    await tx
      .update(workshopTestimonials)
      .set({ isPublished })
      .where(eq(workshopTestimonials.id, row.id));
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "WORKSHOP_TESTIMONIAL_UPDATED",
      targetType: "workshop_testimonial",
      targetId: row.id,
      metadata: { isPublished },
    });
  });
}

// One place up or down: swapped with its neighbour.
export async function moveTestimonial(
  adminUserId: string,
  id: string,
  direction: "up" | "down",
) {
  return db.transaction(async (tx) => {
    await assertAdmin(tx, adminUserId);
    const row = await findTestimonial(tx, id);
    const all = await listTestimonials(tx, row.workshopId, {
      publishedOnly: false,
    });
    const index = all.findIndex((t) => t.id === row.id);
    const other = all[direction === "up" ? index - 1 : index + 1];
    if (!other) return;
    // Renumbered first, so equal positions can't keep them stuck.
    for (const [i, t] of all.entries()) {
      const position =
        t.id === row.id
          ? all.indexOf(other) + 1
          : t.id === other.id
            ? index + 1
            : i + 1;
      await tx
        .update(workshopTestimonials)
        .set({ position })
        .where(eq(workshopTestimonials.id, t.id));
    }
  });
}

// For good (an admin's own content, not a member's record). The image file
// stays in the bucket.
export async function deleteTestimonial(adminUserId: string, id: string) {
  return db.transaction(async (tx) => {
    await assertAdmin(tx, adminUserId);
    const row = await findTestimonial(tx, id);
    await tx
      .delete(workshopTestimonials)
      .where(eq(workshopTestimonials.id, row.id));
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "WORKSHOP_TESTIMONIAL_DELETED",
      targetType: "workshop_testimonial",
      targetId: row.id,
      metadata: { kind: row.kind },
    });
  });
}
