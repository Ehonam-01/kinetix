import { MessagesSquare } from "lucide-react";
import { db } from "@/db/client";
import { cn } from "@/lib/utils";
import {
  listLessonDiscussion,
  type LessonPostView,
  type LessonQuestionView,
  type PostAuthorBadge,
} from "@/repositories/lesson-discussions";
import { AnswerForm, AskQuestionForm, PostMenu } from "./discussion-client";

const BADGE: Record<
  Exclude<PostAuthorBadge, null>,
  { label: string; className: string }
> = {
  TEAM: { label: "Équipe Kinetix", className: "bg-primary/10 text-primary" },
  MENTOR: {
    label: "Mentor",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
};

function PostHeader({
  post,
  courseId,
  lessonId,
}: {
  post: LessonPostView;
  courseId: string;
  lessonId: string;
}) {
  const badge = post.authorBadge ? BADGE[post.authorBadge] : null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className="text-foreground font-semibold">
        @{post.authorUsername}
      </span>
      {badge && (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-medium",
            badge.className,
          )}
        >
          {badge.label}
        </span>
      )}
      <span className="text-muted-foreground">
        {post.createdAt.toLocaleDateString("fr-FR", { dateStyle: "medium" })}
      </span>
      <span className="ml-auto">
        <PostMenu
          courseId={courseId}
          lessonId={lessonId}
          postId={post.id}
          isMine={post.isMine}
          reportedByMe={post.reportedByMe}
        />
      </span>
    </div>
  );
}

// Questions & answers under a lesson (services/lms/lesson-discussion.ts
// holds the rules: access, no links for members, reports, moderation).
export async function LessonDiscussion({
  courseId,
  lessonId,
  viewerId,
}: {
  courseId: string;
  lessonId: string;
  viewerId: string;
}) {
  const questions = await listLessonDiscussion(db, lessonId, viewerId);
  return (
    <DiscussionView
      courseId={courseId}
      lessonId={lessonId}
      questions={questions}
    />
  );
}

export function DiscussionView({
  courseId,
  lessonId,
  questions,
}: {
  courseId: string;
  lessonId: string;
  questions: LessonQuestionView[];
}) {
  return (
    <section
      id="questions"
      className="border-border bg-card scroll-mt-6 space-y-5 rounded-2xl border p-5 sm:p-6"
    >
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 font-semibold">
          <MessagesSquare className="text-brand-accent size-5" />
          Questions & réponses
          {questions.length > 0 && (
            <span className="text-muted-foreground font-normal">
              ({questions.length})
            </span>
          )}
        </h2>
        <p className="text-muted-foreground text-xs">
          Posez vos questions sur cette leçon et aidez les autres membres.
          Restez bienveillant : pas de liens, pas de promesses de gains ni de
          recrutement. Un message signalé plusieurs fois est masqué.
        </p>
      </div>

      <AskQuestionForm courseId={courseId} lessonId={lessonId} />

      {questions.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucune question pour l&apos;instant.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {questions.map((q) => (
            <li key={q.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
              <PostHeader post={q} courseId={courseId} lessonId={lessonId} />
              <p className="text-sm whitespace-pre-wrap">{q.body}</p>
              {q.answers.length > 0 && (
                <ul className="border-border space-y-3 border-l-2 pl-4">
                  {q.answers.map((a) => (
                    <li key={a.id} className="space-y-1.5">
                      <PostHeader
                        post={a}
                        courseId={courseId}
                        lessonId={lessonId}
                      />
                      <p className="text-sm whitespace-pre-wrap">{a.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              <AnswerForm
                courseId={courseId}
                lessonId={lessonId}
                questionId={q.id}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
