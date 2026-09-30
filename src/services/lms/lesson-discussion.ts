import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getSiteEnv } from "@/config/env.site";
import { db } from "@/db/client";
import type { Executor } from "@/db/executor";
import { lessons, modules } from "@/db/schema/courses";
import { lessonPostReports, lessonPosts } from "@/db/schema/lesson-discussions";
import { profiles } from "@/db/schema/profiles";
import { escapeHtml } from "@/lib/escape-html";
import { isRateLimited, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { findAuthEmailByUserId } from "@/repositories/auth-users";
import { hasCourseAccess } from "@/repositories/courses";
import { logAdminAction } from "@/services/admin/audit-log";
import { resendEmailProvider } from "@/services/notifications/resend-email";

export const LESSON_POST_MIN = 3;
export const LESSON_POST_MAX = 2000;
// Distinct members' reports that hide a post until an admin looks at it.
export const REPORTS_TO_AUTO_HIDE = 3;

// Links are the main vehicle for spam and scams (and for recruiting pitches
// that have nothing to do with the lesson): members can't post any; the
// team can.
const LINK_PATTERN = /(https?:\/\/|www\.|wa\.me\/|t\.me\/|bit\.ly\/)/i;

async function findLessonContext(executor: Executor, lessonId: string) {
  const lesson = await executor.query.lessons.findFirst({
    where: eq(lessons.id, lessonId),
  });
  if (!lesson || !lesson.isActive) return null;
  const lessonModule = await executor.query.modules.findFirst({
    where: eq(modules.id, lesson.moduleId),
  });
  if (!lessonModule || !lessonModule.isActive) return null;
  return { lesson, courseId: lessonModule.courseId };
}

// Posting needs the same access as reading the lesson itself: a valid
// subscription (grace period included) to a published course — or admin.
async function assertCanPost(userId: string, lessonId: string) {
  const [profile, context] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(profiles.id, userId) }),
    findLessonContext(db, lessonId),
  ]);
  if (!profile || !context) throw new Error("Leçon introuvable.");
  const isAdmin = profile.role === "ADMIN";
  if (!isAdmin && !(await hasCourseAccess(db, userId, context.courseId))) {
    throw new Error("Vous n'avez pas accès à cette formation.");
  }
  if (await isRateLimited("lessonPost", `user:${userId}`)) {
    throw new Error(RATE_LIMIT_MESSAGE);
  }
  return { profile, isAdmin, ...context };
}

function cleanBody(raw: string, allowLinks: boolean) {
  const body = raw.trim().replace(/\n{3,}/g, "\n\n");
  if (body.length < LESSON_POST_MIN) {
    throw new Error("Votre message est trop court.");
  }
  if (body.length > LESSON_POST_MAX) {
    throw new Error(
      `Votre message dépasse ${LESSON_POST_MAX.toLocaleString("fr-FR")} caractères.`,
    );
  }
  if (!allowLinks && LINK_PATTERN.test(body)) {
    throw new Error(
      "Les liens ne sont pas autorisés dans les questions et réponses.",
    );
  }
  return body;
}

export async function postLessonQuestion(
  userId: string,
  lessonId: string,
  rawBody: string,
) {
  const { isAdmin } = await assertCanPost(userId, lessonId);
  const body = cleanBody(rawBody, isAdmin);
  const [post] = await db
    .insert(lessonPosts)
    .values({ lessonId, authorId: userId, body })
    .returning();
  return post;
}

export async function postLessonAnswer(
  userId: string,
  questionId: string,
  rawBody: string,
) {
  const question = await db.query.lessonPosts.findFirst({
    where: eq(lessonPosts.id, questionId),
  });
  if (!question || question.parentId !== null || question.hiddenAt) {
    throw new Error("Cette question n'existe plus.");
  }
  const { isAdmin, lesson, courseId } = await assertCanPost(
    userId,
    question.lessonId,
  );
  const body = cleanBody(rawBody, isAdmin);
  const [answer] = await db
    .insert(lessonPosts)
    .values({
      lessonId: question.lessonId,
      parentId: questionId,
      authorId: userId,
      body,
    })
    .returning();

  if (question.authorId !== userId) {
    await notifyQuestionAnswered(question.authorId, userId, {
      lessonTitle: lesson.title,
      lessonUrl: `${getSiteEnv().SITE_URL}/dashboard/courses/${courseId}/lessons/${lesson.id}#questions`,
    });
  }
  return answer;
}

// Best effort, after the answer is saved: an email that can't be sent
// never undoes the answer.
async function notifyQuestionAnswered(
  askerId: string,
  answererId: string,
  context: { lessonTitle: string; lessonUrl: string },
) {
  try {
    const [to, answerer] = await Promise.all([
      findAuthEmailByUserId(db, askerId),
      db.query.profiles.findFirst({ where: eq(profiles.id, answererId) }),
    ]);
    if (!to) return;
    const who = answerer ? `@${escapeHtml(answerer.username)}` : "Un membre";
    const lesson = escapeHtml(context.lessonTitle);
    await resendEmailProvider.sendEmail({
      to,
      subject: "Nouvelle réponse à votre question",
      html: `
        <p>${who} a répondu à votre question sur la leçon « ${lesson} ».</p>
        <p><a href="${context.lessonUrl}">Voir la réponse</a></p>
      `,
      text: `${who.replace(/&[^;]+;/g, "")} a répondu à votre question sur la leçon « ${context.lessonTitle} ».\n\nVoir la réponse : ${context.lessonUrl}`,
    });
  } catch (err) {
    console.error("Email de réponse non envoyé :", err);
  }
}

// A member removes their own question or answer (hidden, not erased).
export async function deleteOwnLessonPost(userId: string, postId: string) {
  const [hidden] = await db
    .update(lessonPosts)
    .set({ hiddenAt: sql`now()`, hiddenReason: "AUTHOR", hiddenBy: userId })
    .where(
      and(
        eq(lessonPosts.id, postId),
        eq(lessonPosts.authorId, userId),
        isNull(lessonPosts.hiddenAt),
      ),
    )
    .returning();
  if (!hidden) throw new Error("Ce message n'existe plus.");
}

// One report per member per post. After REPORTS_TO_AUTO_HIDE distinct
// reports the post is hidden right away, pending an admin's decision.
export async function reportLessonPost(
  userId: string,
  postId: string,
  reason?: string,
) {
  const post = await db.query.lessonPosts.findFirst({
    where: eq(lessonPosts.id, postId),
  });
  if (!post || post.hiddenAt) throw new Error("Ce message n'existe plus.");
  if (post.authorId === userId) {
    throw new Error("Vous ne pouvez pas signaler votre propre message.");
  }
  await assertCanPost(userId, post.lessonId);

  await db.transaction(async (tx) => {
    await tx
      .insert(lessonPostReports)
      .values({
        postId,
        reporterId: userId,
        reason: reason?.trim().slice(0, 500) || null,
      })
      .onConflictDoNothing();
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(lessonPostReports)
      .where(
        and(
          eq(lessonPostReports.postId, postId),
          isNull(lessonPostReports.resolvedAt),
        ),
      );
    if (count >= REPORTS_TO_AUTO_HIDE) {
      await tx
        .update(lessonPosts)
        .set({ hiddenAt: sql`now()`, hiddenReason: "REPORTS" })
        .where(and(eq(lessonPosts.id, postId), isNull(lessonPosts.hiddenAt)));
    }
  });
}

async function assertAdmin(adminUserId: string) {
  const admin = await db.query.profiles.findFirst({
    where: eq(profiles.id, adminUserId),
  });
  if (admin?.role !== "ADMIN") {
    throw new Error("Seul un administrateur peut modérer les discussions.");
  }
}

async function resolveReports(
  executor: Executor,
  adminUserId: string,
  postId: string,
) {
  await executor
    .update(lessonPostReports)
    .set({ resolvedAt: sql`now()`, resolvedBy: adminUserId })
    .where(
      and(
        eq(lessonPostReports.postId, postId),
        isNull(lessonPostReports.resolvedAt),
      ),
    );
}

export async function adminHideLessonPost(adminUserId: string, postId: string) {
  await assertAdmin(adminUserId);
  await db.transaction(async (tx) => {
    await tx
      .update(lessonPosts)
      .set({
        hiddenAt: sql`now()`,
        hiddenReason: "ADMIN",
        hiddenBy: adminUserId,
      })
      .where(eq(lessonPosts.id, postId));
    await resolveReports(tx, adminUserId, postId);
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "LESSON_POST_HIDDEN",
      targetType: "lesson_post",
      targetId: postId,
    });
  });
}

// Puts a post back (a report judged unfounded, or a mistake) — except one
// its own author deleted, which stays their decision.
export async function adminRestoreLessonPost(
  adminUserId: string,
  postId: string,
) {
  await assertAdmin(adminUserId);
  await db.transaction(async (tx) => {
    const post = await tx.query.lessonPosts.findFirst({
      where: eq(lessonPosts.id, postId),
    });
    if (!post) throw new Error("Message introuvable.");
    if (post.hiddenReason === "AUTHOR") {
      throw new Error("Ce message a été supprimé par son auteur.");
    }
    await tx
      .update(lessonPosts)
      .set({ hiddenAt: null, hiddenReason: null, hiddenBy: null })
      .where(eq(lessonPosts.id, postId));
    await resolveReports(tx, adminUserId, postId);
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "LESSON_POST_RESTORED",
      targetType: "lesson_post",
      targetId: postId,
    });
  });
}

// Reports judged unfounded, post left as it is.
export async function adminDismissLessonPostReports(
  adminUserId: string,
  postId: string,
) {
  await assertAdmin(adminUserId);
  await db.transaction(async (tx) => {
    await resolveReports(tx, adminUserId, postId);
    await logAdminAction(tx, {
      actorUserId: adminUserId,
      action: "LESSON_POST_REPORTS_DISMISSED",
      targetType: "lesson_post",
      targetId: postId,
    });
  });
}
