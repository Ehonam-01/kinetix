import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import type { Executor } from "@/db/executor";
import { lessons, modules } from "@/db/schema/courses";
import { profiles } from "@/db/schema/profiles";
import { logAdminAction } from "@/services/admin/audit-log";

export type MoveDirection = "up" | "down";

async function assertAdmin(tx: Executor, adminUserId: string) {
  const admin = await tx.query.profiles.findFirst({
    where: eq(profiles.id, adminUserId),
  });
  if (admin?.role !== "ADMIN") {
    throw new Error("Seul un administrateur peut réorganiser un cours.");
  }
}

// The row to swap with: the nearest sibling above or below, whatever the gap
// between positions (they're not guaranteed contiguous). Hidden siblings
// count too — the order is the same one the admin editor shows.
function neighborOf<T extends { id: string }>(
  siblings: T[],
  id: string,
  direction: MoveDirection,
): { current: T; neighbor: T | null } {
  const index = siblings.findIndex((s) => s.id === id);
  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  return {
    current: siblings[index],
    neighbor: siblings[neighborIndex] ?? null,
  };
}

// Swaps a module with the one above/below it. positions are unique per
// course, so the swap goes through a temporary negative position.
export async function moveModule(
  adminUserId: string,
  moduleId: string,
  direction: MoveDirection,
) {
  return db.transaction(async (tx) => {
    await assertAdmin(tx, adminUserId);
    const target = await tx.query.modules.findFirst({
      where: eq(modules.id, moduleId),
    });
    if (!target) throw new Error("Module introuvable.");

    const siblings = await tx.query.modules.findMany({
      where: eq(modules.courseId, target.courseId),
      orderBy: asc(modules.position),
    });
    const { current, neighbor } = neighborOf(siblings, moduleId, direction);
    if (!neighbor) return; // already first/last — nothing to do

    await tx
      .update(modules)
      .set({ position: -1 })
      .where(eq(modules.id, current.id));
    await tx
      .update(modules)
      .set({ position: current.position })
      .where(eq(modules.id, neighbor.id));
    await tx
      .update(modules)
      .set({ position: neighbor.position })
      .where(eq(modules.id, current.id));

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "MODULE_MOVED",
      targetType: "module",
      targetId: moduleId,
      metadata: { courseId: target.courseId, direction },
    });
  });
}

// Same, for a lesson within its module.
export async function moveLesson(
  adminUserId: string,
  lessonId: string,
  direction: MoveDirection,
) {
  return db.transaction(async (tx) => {
    await assertAdmin(tx, adminUserId);
    const target = await tx.query.lessons.findFirst({
      where: eq(lessons.id, lessonId),
    });
    if (!target) throw new Error("Leçon introuvable.");

    const siblings = await tx.query.lessons.findMany({
      where: eq(lessons.moduleId, target.moduleId),
      orderBy: asc(lessons.position),
    });
    const { current, neighbor } = neighborOf(siblings, lessonId, direction);
    if (!neighbor) return;

    await tx
      .update(lessons)
      .set({ position: -1 })
      .where(eq(lessons.id, current.id));
    await tx
      .update(lessons)
      .set({ position: current.position })
      .where(eq(lessons.id, neighbor.id));
    await tx
      .update(lessons)
      .set({ position: neighbor.position })
      .where(eq(lessons.id, current.id));

    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "LESSON_MOVED",
      targetType: "lesson",
      targetId: lessonId,
      metadata: { moduleId: target.moduleId, direction },
    });
  });
}
