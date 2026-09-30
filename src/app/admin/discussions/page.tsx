import Link from "next/link";
import { db } from "@/db/client";
import {
  listHiddenLessonPosts,
  listReportedLessonPosts,
  listUnansweredLessonQuestions,
  type AdminLessonPost,
} from "@/repositories/lesson-discussions";
import { requireAdmin } from "@/services/auth/current-user";
import { ModerationButtons } from "./moderation-buttons";

const HIDDEN_LABEL: Record<string, string> = {
  ADMIN: "Masqué par un admin",
  REPORTS: "Masqué automatiquement (signalements)",
};

function PostCard({
  post,
  decisions,
}: {
  post: AdminLessonPost;
  decisions: ("hide" | "restore" | "dismiss")[];
}) {
  return (
    <div className="space-y-2 rounded-2xl border px-4 py-3 text-sm">
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="text-foreground font-medium">
          @{post.authorUsername}
        </span>
        <span>{post.isQuestion ? "Question" : "Réponse"}</span>
        <span>·</span>
        <Link href={post.lessonHref} className="text-primary hover:underline">
          {post.lessonTitle}
        </Link>
        <span>·</span>
        <span>
          {post.createdAt.toLocaleDateString("fr-FR", { dateStyle: "medium" })}
        </span>
        {post.hiddenReason && (
          <span className="bg-muted rounded-full px-2 py-0.5">
            {HIDDEN_LABEL[post.hiddenReason] ?? "Masqué"}
          </span>
        )}
      </div>
      <p className="whitespace-pre-wrap">{post.body}</p>
      {post.openReports > 0 && (
        <p className="text-destructive text-xs">
          {post.openReports} signalement(s)
          {post.reportReasons.length > 0 &&
            ` : ${post.reportReasons.join(" · ")}`}
        </p>
      )}
      <ModerationButtons postId={post.id} decisions={decisions} />
    </div>
  );
}

function Section({
  title,
  description,
  empty,
  children,
  count,
}: {
  title: string;
  description: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold">
          {title} ({count})
        </h2>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      {count === 0 ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </section>
  );
}

export default async function AdminDiscussionsPage() {
  // Re-checked here, not only in admin/layout.tsx: a layout isn't
  // re-run on every navigation, so it can't be the only gate (Next.js
  // authentication guide, "Layouts and auth checks").
  await requireAdmin();
  const [reported, unanswered, hidden] = await Promise.all([
    listReportedLessonPosts(db),
    listUnansweredLessonQuestions(db),
    listHiddenLessonPosts(db),
  ]);

  return (
    <div className="space-y-10">
      <Section
        title="Signalés"
        count={reported.length}
        description="Messages signalés par des membres. À 3 signalements, un message est masqué automatiquement en attendant votre décision."
        empty="Aucun signalement en attente."
      >
        {reported.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            decisions={
              p.hiddenReason ? ["restore", "hide"] : ["hide", "dismiss"]
            }
          />
        ))}
      </Section>

      <Section
        title="Questions sans réponse"
        count={unanswered.length}
        description="Les plus anciennes d'abord. Ouvrez la leçon pour répondre : vos réponses portent le badge « Équipe Kinetix »."
        empty="Toutes les questions ont une réponse."
      >
        {unanswered.map((p) => (
          <PostCard key={p.id} post={p} decisions={["hide"]} />
        ))}
      </Section>

      <Section
        title="Messages masqués"
        count={hidden.length}
        description="Masqués par un admin ou par les signalements. Les messages supprimés par leur auteur n'apparaissent pas ici."
        empty="Aucun message masqué."
      >
        {hidden.map((p) => (
          <PostCard key={p.id} post={p} decisions={["restore"]} />
        ))}
      </Section>
    </div>
  );
}
