import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { db } from "@/db/client";
import { CourseCard } from "@/app/_components/course-card";
import { GOAL_DETAILS } from "@/app/_components/goal-section";
import { buttonVariants } from "@/components/ui/button";
import {
  GOAL_COURSE_SLUGS,
  GOAL_OPTIONS,
  goalLabel,
  isGoalValue,
  type GoalValue,
} from "@/config/goals";
import { SITE_NAME } from "@/config/site";
import { formatPrice } from "@/lib/format-price";
import { splitTranches } from "@/lib/split-payment";
import { cn } from "@/lib/utils";
import { listPublishedCoursesForMarketing } from "@/repositories/courses";
import { getLaunchOffer } from "@/services/pricing/launch-offer";
import { SITE_OG_IMAGE } from "@/config/og";

// What comes with the subscription beyond the courses, said where a goal
// is about people rather than skills.
const GOAL_EXTRA: Partial<Record<GoalValue, string>> = {
  mentor:
    "Avec l'abonnement, tu peux échanger avec des mentors qui ont déjà fait le chemin et te faire accompagner.",
  reseau:
    "Avec l'abonnement, tu rejoins la communauté des membres sur WhatsApp et Discord pour échanger et avancer ensemble.",
  incertain:
    "Une fois inscrit, l'équipe t'aide à trouver ta direction avec un questionnaire d'orientation, puis te propose un mentor.",
};

const INCLUDED = [
  "Tout le catalogue de formations, à ton rythme",
  "Les mentors et la communauté des membres",
  "Sans engagement : aucun renouvellement automatique",
];

export function generateStaticParams() {
  return GOAL_OPTIONS.map((goal) => ({ objectif: goal.value }));
}

// Same ISR window as the catalogue: a course published by an admin shows
// up within 10 minutes.
export const revalidate = 600;

export async function generateMetadata({
  params,
}: PageProps<"/orientation/[objectif]">): Promise<Metadata> {
  const { objectif } = await params;
  const label = goalLabel(objectif);
  if (!label) return {};
  const title = `${label} — ${SITE_NAME}`;
  const description = `Les formations ${SITE_NAME} pour « ${label} », et comment commencer.`;
  return {
    title,
    description,
    alternates: { canonical: `/orientation/${objectif}` },
    openGraph: {
      title,
      description,
      url: `/orientation/${objectif}`,
      images: [SITE_OG_IMAGE],
    },
  };
}

// The public page behind each "Que veux-tu accomplir ?" card (explicit user
// decision): the courses recommended for that goal (config/goals.ts), what
// the subscription brings, then sign-up. app/orientation/route.ts sends a
// visitor here and remembers the goal for their sign-up; a member goes to
// their own orientation in the dashboard instead.
export default async function OrientationGoalPage({
  params,
}: PageProps<"/orientation/[objectif]">) {
  const { objectif } = await params;
  if (!isGoalValue(objectif)) notFound();
  const goal = objectif;
  const label = goalLabel(goal)!;
  const { icon: Icon, description } = GOAL_DETAILS[goal];

  const [courses, offer] = await Promise.all([
    listPublishedCoursesForMarketing(db),
    getLaunchOffer(db),
  ]);
  const bySlug = new Map(courses.map((c) => [c.slug, c]));
  const picked = GOAL_COURSE_SLUGS[goal]
    .map((slug) => bySlug.get(slug))
    .filter((course) => course !== undefined);
  const recommended = picked.length > 0 ? picked : courses;
  const tranches = splitTranches(offer.price);
  const extra = GOAL_EXTRA[goal];

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <span className="bg-brand-accent/15 text-brand-accent mx-auto flex size-12 items-center justify-center rounded-2xl">
          <Icon aria-hidden="true" className="size-6" />
        </span>
        <p className="text-brand-accent mt-4 text-xs font-semibold tracking-widest uppercase">
          Ton objectif
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          {label}
        </h1>
        <p className="text-muted-foreground mt-4 text-lg text-pretty">
          {description}
        </p>
      </div>

      <h2 className="mt-14 text-2xl font-semibold">
        {picked.length > 0
          ? "Les formations pour commencer"
          : "Toutes les formations"}
      </h2>
      {recommended.length === 0 ? (
        <p className="text-muted-foreground mt-3">
          De nouvelles formations arrivent très bientôt.
        </p>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {recommended.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
      {picked.length > 0 && (
        <p className="mt-6 text-center text-sm">
          <Link
            href="/formations"
            className="text-primary inline-flex items-center gap-1 underline underline-offset-4"
          >
            Voir toutes les formations
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </p>
      )}

      <div className="border-brand-accent/40 bg-card mx-auto mt-14 max-w-2xl rounded-3xl border-2 p-6 text-center shadow-lg sm:p-8">
        <h2 className="text-2xl font-semibold text-balance">
          Commence avec l&apos;abonnement {SITE_NAME}
        </h2>
        {extra && <p className="text-muted-foreground mt-3">{extra}</p>}
        <ul className="mx-auto mt-5 max-w-md space-y-2 text-left text-sm">
          {INCLUDED.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-lg font-semibold">
          {formatPrice(offer.price)} / an
        </p>
        {tranches && (
          <p className="text-muted-foreground mt-1 text-sm">
            ou en 3 fois : {formatPrice(tranches[0])} aujourd&apos;hui, puis{" "}
            {tranches[1] === tranches[2]
              ? `2 × ${formatPrice(tranches[1])}`
              : `${formatPrice(tranches[1])} et ${formatPrice(tranches[2])}`}
          </p>
        )}
        <Link
          href="/register"
          className={cn(
            buttonVariants({ size: "lg" }),
            "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90 mt-6 h-12 w-full text-base sm:w-auto sm:px-10",
          )}
        >
          Je crée mon compte
        </Link>
      </div>
    </section>
  );
}
