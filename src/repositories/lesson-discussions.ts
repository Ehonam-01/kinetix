import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
} from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { courses, lessons, modules } from "@/db/schema/courses";
import { lessonPostReports, lessonPosts } from "@/db/schema/lesson-discussions";
import { mentorProfiles } from "@/db/schema/mentor-profiles";
import { profiles } from "@/db/schema/profiles";

// "TEAM" (an admin) or "MENTOR" (an approved mentor): shown as a badge so
// a member can tell an answer from the team apart from another member's.
export type PostAuthorBadge = "TEAM" | "MENTOR" | null;

export type LessonPostView = {
  id: string;
  body: string;
  createdAt: Date;
  authorUsername: string;
  authorBadge: PostAuthorBadge;
  isMine: boolean;
  reportedByMe: boolean;
};

export type LessonQuestionView = LessonPostView & {
  answers: LessonPostView[];
};

const MAX_QUESTIONS = 100;

async function authorInfo(executor: Executor, authorIds: string[]) {
  if (authorIds.length === 0) {
    return new Map<string, { username: string; badge: PostAuthorBadge }>();
  }
  const [authors, mentors] = await Promise.all([
    executor.query.profiles.findMany({
      where: inArray(profiles.id, authorIds),
      columns: { id: true, username: true, role: true },
    }),
    executor.query.mentorProfiles.findMany({
      where: and(
        inArray(mentorProfiles.userId, authorIds),
        eq(mentorProfiles.status, "APPROVED"),
      ),
      columns: { userId: true },
    }),
  ]);
  const mentorIds = new Set(mentors.map((m) => m.userId));
  return new Map(
    authors.map((a) => [
      a.id,
      {
        username: a.username,
        badge: (a.role === "ADMIN"
          ? "TEAM"
          : mentorIds.has(a.id)
            ? "MENTOR"
            : null) as PostAuthorBadge,
      },
    ]),
  );
}

// A lesson's visible questions (newest first) with their visible answers
// (oldest first, like a conversation). Hidden posts are left out entirely.
export async function listLessonDiscussion(
  executor: Executor,
  lessonId: string,
  viewerId: string,
): Promise<LessonQuestionView[]> {
  const questions = await executor.query.lessonPosts.findMany({
    where: and(
      eq(lessonPosts.lessonId, lessonId),
      isNull(lessonPosts.parentId),
      isNull(lessonPosts.hiddenAt),
    ),
    orderBy: desc(lessonPosts.createdAt),
    limit: MAX_QUESTIONS,
  });
  if (questions.length === 0) return [];

  const answers = await executor.query.lessonPosts.findMany({
    where: and(
      inArray(
        lessonPosts.parentId,
        questions.map((q) => q.id),
      ),
      isNull(lessonPosts.hiddenAt),
    ),
    orderBy: asc(lessonPosts.createdAt),
  });
  const all = [...questions, ...answers];
  const [authors, myReports] = await Promise.all([
    authorInfo(executor, [...new Set(all.map((p) => p.authorId))]),
    executor.query.lessonPostReports.findMany({
      where: and(
        eq(lessonPostReports.reporterId, viewerId),
        inArray(
          lessonPostReports.postId,
          all.map((p) => p.id),
        ),
      ),
      columns: { postId: true },
    }),
  ]);
  const reported = new Set(myReports.map((r) => r.postId));
  const view = (p: (typeof all)[number]): LessonPostView => ({
    id: p.id,
    body: p.body,
    createdAt: p.createdAt,
    authorUsername: authors.get(p.authorId)?.username ?? "membre",
    authorBadge: authors.get(p.authorId)?.badge ?? null,
    isMine: p.authorId === viewerId,
    reportedByMe: reported.has(p.id),
  });

  return questions.map((q) => ({
    ...view(q),
    answers: answers.filter((a) => a.parentId === q.id).map(view),
  }));
}

export type AdminLessonPost = {
  id: string;
  body: string;
  createdAt: Date;
  isQuestion: boolean;
  authorUsername: string;
  lessonTitle: string;
  lessonHref: string;
  hiddenReason: string | null;
  openReports: number;
  reportReasons: string[];
};

async function toAdminPosts(
  executor: Executor,
  posts: (typeof lessonPosts.$inferSelect)[],
): Promise<AdminLessonPost[]> {
  if (posts.length === 0) return [];
  const lessonIds = [...new Set(posts.map((p) => p.lessonId))];
  const [authors, lessonRows, reports] = await Promise.all([
    authorInfo(executor, [...new Set(posts.map((p) => p.authorId))]),
    executor
      .select({
        id: lessons.id,
        title: lessons.title,
        courseId: modules.courseId,
      })
      .from(lessons)
      .innerJoin(modules, eq(modules.id, lessons.moduleId))
      .innerJoin(courses, eq(courses.id, modules.courseId))
      .where(inArray(lessons.id, lessonIds)),
    executor.query.lessonPostReports.findMany({
      where: and(
        inArray(
          lessonPostReports.postId,
          posts.map((p) => p.id),
        ),
        isNull(lessonPostReports.resolvedAt),
      ),
    }),
  ]);
  const lessonById = new Map(lessonRows.map((l) => [l.id, l]));
  return posts.map((p) => {
    const lesson = lessonById.get(p.lessonId);
    const postReports = reports.filter((r) => r.postId === p.id);
    return {
      id: p.id,
      body: p.body,
      createdAt: p.createdAt,
      isQuestion: p.parentId === null,
      authorUsername: authors.get(p.authorId)?.username ?? "membre",
      lessonTitle: lesson?.title ?? "Leçon",
      lessonHref: lesson
        ? `/dashboard/courses/${lesson.courseId}/lessons/${lesson.id}#questions`
        : "#",
      hiddenReason: p.hiddenReason,
      openReports: postReports.length,
      reportReasons: postReports.flatMap((r) => (r.reason ? [r.reason] : [])),
    };
  });
}

// Moderation queue: every post with an unresolved report, hidden or not.
export async function listReportedLessonPosts(executor: Executor) {
  const reported = await executor
    .selectDistinct({ postId: lessonPostReports.postId })
    .from(lessonPostReports)
    .where(isNull(lessonPostReports.resolvedAt));
  if (reported.length === 0) return [];
  const posts = await executor.query.lessonPosts.findMany({
    where: inArray(
      lessonPosts.id,
      reported.map((r) => r.postId),
    ),
    orderBy: desc(lessonPosts.createdAt),
  });
  return toAdminPosts(executor, posts);
}

// Visible questions nobody has answered yet — the ones the team should
// pick up.
export async function listUnansweredLessonQuestions(executor: Executor) {
  const posts = await executor.query.lessonPosts.findMany({
    where: and(
      isNull(lessonPosts.parentId),
      isNull(lessonPosts.hiddenAt),
      sql`not exists (select 1 from ${lessonPosts} a where a.parent_id = ${lessonPosts.id} and a.hidden_at is null)`,
    ),
    orderBy: asc(lessonPosts.createdAt),
    limit: 100,
  });
  return toAdminPosts(executor, posts);
}

// Posts an admin hid or that were auto-hidden, for review or restoring.
export async function listHiddenLessonPosts(executor: Executor) {
  const posts = await executor.query.lessonPosts.findMany({
    where: and(
      isNotNull(lessonPosts.hiddenAt),
      sql`${lessonPosts.hiddenReason} <> 'AUTHOR'`,
    ),
    orderBy: desc(lessonPosts.hiddenAt),
    limit: 50,
  });
  return toAdminPosts(executor, posts);
}
