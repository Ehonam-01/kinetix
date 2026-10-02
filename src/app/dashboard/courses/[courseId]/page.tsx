import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRight,
  Clock,
  Layers,
  MessagesSquare,
  PartyPopper,
  Sparkles,
} from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ambassadorProfiles } from "@/db/schema/ambassador-profiles";
import { getSiteEnv } from "@/config/env.site";
import {
  getCourseContent,
  hasCourseAccess,
  isCourseVisible,
} from "@/repositories/courses";
import { requireUser } from "@/services/auth/current-user";
import { cn, formatDuration } from "@/lib/utils";
import {
  flattenLessons,
  getProgress,
  getResumeLesson,
} from "@/lib/course-navigation";
import { buttonVariants } from "@/components/ui/button";
import { CourseCover } from "@/components/course/course-cover";
import { CourseOutline } from "@/components/course/course-outline";
import { ShareCourse } from "@/components/course/share-course";
import { ProgressBar } from "../_components/progress-bar";

export default async function CourseDetailPage(
  props: PageProps<"/dashboard/courses/[courseId]">,
) {
  const { courseId } = await props.params;
  const { profile } = await requireUser();
  // Same reasoning as /dashboard/courses/page.tsx: reachable by a plain
  // customer, not just an ACTIVE ambassador.
  if (profile.status === "SUSPENDED") redirect("/dashboard");

  const content = await getCourseContent(db, courseId, profile.id);
  // A draft is only reachable by an admin reviewing it.
  if (
    !content ||
    (profile.role !== "ADMIN" && !isCourseVisible(content.course))
  ) {
    notFound();
  }
  const { course } = content;

  // Every course requires an active annual subscription now (explicit
  // user decision, "remplacement complet" — see db/schema/subscriptions.ts):
  // no per-course purchase prompt, just a link to subscribe.
  const [access, ambassador] = await Promise.all([
    hasCourseAccess(db, profile.id, courseId),
    db.query.ambassadorProfiles.findFirst({
      where: eq(ambassadorProfiles.userId, profile.id),
    }),
  ]);

  // An active ambassador shares their referral link (app/r/[code]), which
  // lands on the same public page; anyone else, the public page itself. A
  // draft has no public page: nothing to share.
  const siteUrl = getSiteEnv().SITE_URL;
  const isAmbassador = ambassador?.status === "ACTIVE";
  const shareUrl = !isCourseVisible(course)
    ? null
    : isAmbassador
      ? `${siteUrl}/r/${ambassador.referralCode}?course=${course.id}`
      : `${siteUrl}/formations/${course.slug ?? course.id}`;

  const lessons = flattenLessons(content);
  const progress = getProgress(lessons);
  const resume = getResumeLesson(lessons);
  const lessonHref = (lessonId: string) =>
    `/dashboard/courses/${courseId}/lessons/${lessonId}`;

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/courses"
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        ← Toutes les formations
      </Link>

      {/* The thumbnail on top, full width and uncropped (16:9, the format
          admins design them in), the details below it. */}
      <div className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm">
        <CourseCover thumbnailUrl={course.thumbnailUrl} />
        <div className="space-y-4 p-5 sm:p-6">
          <div>
            {course.category && (
              <span className="bg-primary/10 text-primary rounded-full px-2.5 py-1 text-xs font-medium">
                {course.category}
              </span>
            )}
            <h1 className="mt-3 text-2xl font-semibold">{course.title}</h1>
            {course.description && (
              <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed whitespace-pre-line">
                {course.description}
              </p>
            )}
          </div>

          <div className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span className="flex items-center gap-1.5">
              <Layers className="size-4" />
              {content.modules.length} module(s) · {lessons.length} leçon(s)
            </span>
            {course.durationMinutes != null && course.durationMinutes > 0 && (
              <span className="flex items-center gap-1.5">
                <Clock className="size-4" />
                {formatDuration(course.durationMinutes)}
              </span>
            )}
          </div>

          {access ? (
            lessons.length > 0 && (
              <div className="space-y-4">
                <div>
                  <div className="text-muted-foreground mb-1.5 flex justify-between text-xs">
                    <span>
                      {progress.completed} / {progress.total} leçons terminées
                    </span>
                    <span>{progress.percent} %</span>
                  </div>
                  <ProgressBar percent={progress.percent} />
                </div>
                {!progress.finished && resume && (
                  <Link
                    href={lessonHref(resume.id)}
                    className={cn(buttonVariants(), "w-full sm:w-auto")}
                  >
                    {progress.completed === 0 ? "Commencer" : "Continuer"}
                    <ArrowRight className="size-4" />
                  </Link>
                )}
              </div>
            )
          ) : (
            <div className="border-primary/20 bg-primary/5 space-y-3 rounded-xl border p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="text-primary size-4" />
                Abonnement requis
              </p>
              <p className="text-muted-foreground text-sm">
                Cette formation, comme toutes les autres, est incluse dans
                l&apos;abonnement annuel.
              </p>
              {course.price != null && (
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-muted-foreground text-xl font-semibold tabular-nums line-through">
                    {course.price.toLocaleString("fr-FR")} F
                  </span>
                  <span className="text-base font-semibold text-emerald-600">
                    Gratuit avec l&apos;abonnement
                  </span>
                </p>
              )}
              <Link
                href="/dashboard/subscription"
                className={cn(buttonVariants(), "w-full sm:w-auto")}
              >
                Voir l&apos;abonnement
              </Link>
            </div>
          )}

          {shareUrl && (
            <ShareCourse
              url={shareUrl}
              courseTitle={course.title}
              className="border-border border-t pt-4"
              hint={
                isAmbassador
                  ? "Votre lien de parrainage est inclus : si la personne s'abonne grâce à ce lien, le parrainage vous est attribué."
                  : undefined
              }
            />
          )}
        </div>
      </div>

      {access && progress.finished && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center sm:p-8">
          <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/15">
            <PartyPopper className="size-7 text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold">
            Bravo, tu as terminé cette formation !
          </h2>
          <p className="text-muted-foreground max-w-md text-sm">
            Les {progress.total} leçons sont validées. Tu peux revenir sur
            n&apos;importe laquelle quand tu veux, ou attaquer une nouvelle
            formation.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/dashboard/courses" className={buttonVariants()}>
              Découvrir d&apos;autres formations
            </Link>
            <Link
              href={lessonHref(lessons[0].id)}
              className={buttonVariants({ variant: "outline" })}
            >
              Revoir depuis le début
            </Link>
          </div>
        </div>
      )}

      <section className="border-border bg-card rounded-2xl border p-5 sm:p-6">
        <h2 className="mb-4 font-semibold">Programme</h2>
        {lessons.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucune leçon pour le moment.
          </p>
        ) : access ? (
          <CourseOutline courseId={courseId} lessons={lessons} />
        ) : (
          <CourseOutline
            courseId={courseId}
            lessons={lessons.map((l) => ({ ...l, locked: false }))}
            preview
          />
        )}
      </section>

      {access && (
        <Link
          href="/dashboard/community"
          className="border-border bg-card hover:bg-muted/50 flex items-center gap-3 rounded-2xl border p-4 text-sm transition-colors"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#5865F2]/10 text-[#5865F2]">
            <MessagesSquare className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              Échangez avec ceux qui suivent cette formation
            </p>
            <p className="text-muted-foreground text-xs">
              Son salon dédié vous attend sur le Discord des membres.
            </p>
          </div>
          <ArrowRight className="text-muted-foreground size-4 shrink-0" />
        </Link>
      )}
    </div>
  );
}
