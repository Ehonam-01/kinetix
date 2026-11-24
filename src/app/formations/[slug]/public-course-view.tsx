import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Infinity as InfinityIcon,
  Layers,
  ListChecks,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import type { getPublicCourse } from "@/repositories/courses";
import { SITE_NAME } from "@/config/site";
import { flattenLessons } from "@/lib/course-navigation";
import { cn, formatDuration } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { CourseCover } from "@/components/course/course-cover";
import { CourseOutline } from "@/components/course/course-outline";
import { CourseReviews } from "@/components/course/course-reviews";
import { ShareCourse } from "@/components/course/share-course";
import { formatPrice } from "@/lib/format-price";
import { getVideoEmbedUrl } from "@/lib/video-embed";
import { HERO_CTA_ID, StickyBuyBar } from "./sticky-buy-bar";
import { CoursePreviewVideo } from "./course-preview-video";

export type PublicCourseContent = NonNullable<
  Awaited<ReturnType<typeof getPublicCourse>>
>;

const ACCENT_BUTTON =
  "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90";

const SUBSCRIPTION_INCLUDES = [
  "Tout le catalogue de formations, à ton rythme",
  "Les mentors et la communauté des membres",
  "Des quiz pour valider chaque étape",
  "Sans engagement : aucun renouvellement automatique",
];

// What a visitor sees of a formation — a sales page (explicit user
// decision): the preview video, what it teaches and for whom, the
// programme, then the two ways in (this course alone, or the subscription)
// side by side. Kept apart from page.tsx (data, metadata, redirects) so it
// only depends on what it's given.
export function PublicCourseView({
  content,
  shareUrl,
  rating,
  reviews,
  subscription,
}: {
  content: PublicCourseContent;
  shareUrl: string;
  // Learners' reviews (services/lms/course-reviews.ts) — real ones only.
  rating: { average: number; count: number } | null;
  reviews: {
    id: string;
    rating: number;
    comment: string | null;
    author: string;
    updatedAt: Date;
  }[];
  // The annual subscription as it's sold today (launch offer included),
  // and its 3 instalments when it can be split.
  subscription: { price: number; tranches: number[] | null };
}) {
  const { course } = content;

  // Titles only — every lesson shown as open, none as done: a visitor has
  // no progress, and locking is a learner-side rule.
  const lessons = flattenLessons(content).map((l) => ({
    ...l,
    completed: false,
    locked: false,
  }));
  const quizCount = lessons.filter((l) => l.hasQuiz).length;
  const memberHref = `/dashboard/courses/${course.id}`;
  const slug = course.slug ?? course.id;
  const buyHref = `/formations/${slug}/acheter`;
  // Sold on its own (and open): the page's main offer. Otherwise the
  // subscription is.
  const salePrice =
    course.salePrice !== null && !course.comingSoon ? course.salePrice : null;
  const struckPrice =
    course.price && (salePrice === null || salePrice < course.price)
      ? course.price
      : null;
  const videoSrc = course.previewVideoUrl
    ? getVideoEmbedUrl("YOUTUBE", course.previewVideoUrl)
    : null;

  const mainHref = salePrice !== null ? buyHref : "/register";
  const mainLabel =
    salePrice !== null ? "Acheter la formation" : `Rejoindre ${SITE_NAME}`;
  const mainPrice = formatPrice(salePrice ?? subscription.price);
  const mainNote = salePrice !== null ? "Accès à vie" : "Par an";

  // schema.org Course — lets search engines show it as a course result.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.description ?? undefined,
    inLanguage: "fr",
    ...(rating && rating.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(rating.average.toFixed(1)),
            reviewCount: rating.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(salePrice !== null
      ? {
          offers: {
            "@type": "Offer",
            price: salePrice,
            priceCurrency: "XOF",
            category: "Paid",
          },
        }
      : {}),
    provider: { "@type": "Organization", name: SITE_NAME },
    ...(course.thumbnailUrl ? { image: course.thumbnailUrl } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify of our own DB fields; "<" escaped so a title can
        // never close the script tag.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <section className="from-primary/10 to-background bg-linear-to-b">
        <div className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-6 sm:pt-8 lg:px-8 lg:pb-16">
          <Link
            href="/formations"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="size-4" />
            Toutes les formations
          </Link>

          <div className="mt-6 grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
            {/* On phones the picture (or video) comes first, right under
                the way back; on a wide screen it sits on the right. */}
            <div className="lg:order-2">
              {videoSrc ? (
                <CoursePreviewVideo
                  embedUrl={videoSrc}
                  thumbnailUrl={course.thumbnailUrl}
                  courseTitle={course.title}
                />
              ) : (
                <CourseCover
                  title={course.title}
                  thumbnailUrl={course.thumbnailUrl}
                  className="rounded-3xl shadow-xl"
                />
              )}
            </div>

            <div className="lg:order-1">
              {course.category && (
                <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-medium">
                  {course.category}
                </span>
              )}
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                {course.title}
              </h1>
              {course.description && (
                <p className="text-muted-foreground mt-4 text-lg leading-relaxed text-pretty whitespace-pre-line">
                  {course.description}
                </p>
              )}

              <CourseFacts
                modules={content.modules.length}
                lessons={lessons.length}
                durationMinutes={course.durationMinutes}
                quizCount={quizCount}
                lifetime={salePrice !== null}
              />

              <div className="mt-6">
                {salePrice !== null ? (
                  <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-3xl font-bold tabular-nums">
                      {formatPrice(salePrice)}
                    </span>
                    {struckPrice !== null && (
                      <span className="text-muted-foreground text-xl font-semibold tabular-nums line-through">
                        {formatPrice(struckPrice)}
                      </span>
                    )}
                    <span className="text-muted-foreground text-sm">
                      un seul paiement, accès à vie
                    </span>
                  </p>
                ) : (
                  <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    {struckPrice !== null && (
                      <span className="text-muted-foreground text-xl font-semibold tabular-nums line-through">
                        {formatPrice(struckPrice)}
                      </span>
                    )}
                    <span className="text-lg font-semibold text-emerald-600">
                      Incluse dans l&apos;abonnement annuel
                    </span>
                  </p>
                )}

                <Link
                  id={HERO_CTA_ID}
                  href={mainHref}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    ACCENT_BUTTON,
                    "mt-5 h-12 w-full text-base sm:w-auto sm:px-10",
                  )}
                >
                  {salePrice !== null
                    ? `${mainLabel} – ${mainPrice}`
                    : mainLabel}
                </Link>

                <div className="mt-4 flex flex-col gap-2 text-sm">
                  {salePrice !== null && (
                    <a
                      href="#offres"
                      className="text-primary underline underline-offset-4"
                    >
                      Ou gratuite avec l&apos;abonnement {SITE_NAME}
                    </a>
                  )}
                  <Link
                    href={memberHref}
                    className="text-muted-foreground hover:text-foreground underline underline-offset-4"
                  >
                    Déjà membre ou déjà achetée ? Accéder à la formation
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-4xl space-y-14 px-4 py-12 sm:px-6 lg:py-16">
        {course.learningOutcomes.length > 0 && (
          <section>
            <h2 className="text-2xl font-semibold">Ce que tu vas apprendre</h2>
            <ul className="bg-card mt-6 grid gap-3 rounded-2xl border p-5 sm:grid-cols-2 sm:p-6">
              {course.learningOutcomes.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {course.targetAudience.length > 0 && (
          <section>
            <h2 className="text-2xl font-semibold">Pour qui ?</h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {course.targetAudience.map((item) => (
                <li
                  key={item}
                  className="bg-card flex items-start gap-3 rounded-2xl border p-4"
                >
                  <span className="bg-brand-accent/15 text-brand-accent flex size-9 shrink-0 items-center justify-center rounded-xl">
                    <UserRound aria-hidden="true" className="size-4" />
                  </span>
                  <span className="pt-1.5">{item}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="text-2xl font-semibold">Programme de la formation</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {salePrice !== null
              ? "Le contenu des leçons est réservé aux abonnés et à celles et ceux qui ont acheté cette formation."
              : "Le contenu des leçons est réservé aux membres abonnés."}
          </p>
          <div className="border-border bg-card mt-6 rounded-2xl border p-5 sm:p-6">
            {lessons.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Le programme sera bientôt en ligne.
              </p>
            ) : (
              <CourseOutline courseId={course.id} lessons={lessons} preview />
            )}
          </div>
          {rating && rating.count > 0 && (
            <CourseReviews
              summary={rating}
              reviews={reviews}
              className="mt-8"
            />
          )}
        </section>

        <section id="offres" className="scroll-mt-24">
          <h2 className="text-2xl font-semibold">
            {salePrice !== null
              ? "Choisis ta formule"
              : "Accède à cette formation"}
          </h2>
          <div
            className={cn(
              "mt-6 grid gap-5",
              salePrice !== null && "md:grid-cols-2",
            )}
          >
            {salePrice !== null && (
              <OfferCard
                highlighted
                title="Cette formation seule"
                price={formatPrice(salePrice)}
                struck={struckPrice !== null ? formatPrice(struckPrice) : null}
                priceNote="un seul paiement"
                items={[
                  "Accès à vie à cette formation",
                  "Sans abonnement, sans renouvellement",
                  "À ton rythme, sur téléphone ou ordinateur",
                ]}
                href={buyHref}
                cta="Acheter la formation"
              />
            )}
            <OfferCard
              highlighted={salePrice === null}
              title={`Abonnement ${SITE_NAME}`}
              price={formatPrice(subscription.price)}
              priceNote="par an"
              extra={
                subscription.tranches
                  ? `ou en 3 fois : ${formatPrice(subscription.tranches[0])} aujourd'hui, puis ${
                      subscription.tranches[1] === subscription.tranches[2]
                        ? `2 × ${formatPrice(subscription.tranches[1])}`
                        : `${formatPrice(subscription.tranches[1])} et ${formatPrice(subscription.tranches[2])}`
                    }, selon ton pays`
                  : null
              }
              items={["Cette formation incluse", ...SUBSCRIPTION_INCLUDES]}
              href="/register"
              cta="Je crée mon compte"
            />
          </div>
          <ul className="text-muted-foreground mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
            <li className="flex items-center gap-1.5">
              <Smartphone aria-hidden="true" className="size-4" />
              Paiement par mobile money
            </li>
            <li className="flex items-center gap-1.5">
              <ShieldCheck aria-hidden="true" className="size-4" />
              <Link
                href="/conditions-utilisation#remboursement"
                className="underline underline-offset-4"
              >
                Politique de remboursement
              </Link>
            </li>
          </ul>
        </section>

        {course.faq.length > 0 && (
          <section>
            <h2 className="text-2xl font-semibold">Questions fréquentes</h2>
            <div className="mt-6 space-y-3">
              {course.faq.map((item) => (
                <details
                  key={item.question}
                  className="bg-card group rounded-2xl border p-4 sm:p-5"
                >
                  <summary className="cursor-pointer list-none font-medium marker:hidden">
                    <span className="flex items-start justify-between gap-4">
                      {item.question}
                      <span
                        aria-hidden="true"
                        className="text-muted-foreground text-xl leading-none transition-transform group-open:rotate-45"
                      >
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="text-muted-foreground mt-3 whitespace-pre-line">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </section>
        )}

        <ShareCourse
          url={shareUrl}
          courseTitle={course.title}
          className="pb-20 sm:pb-0"
        />
      </div>

      <StickyBuyBar
        href={mainHref}
        label={salePrice !== null ? "Acheter" : "Rejoindre"}
        price={mainPrice}
        note={mainNote}
      />
    </>
  );
}

// The course in a few numbers. "1 module · 1 leçon" says "thin" more than
// it informs, so the counts only show from 2 lessons up.
function CourseFacts({
  modules,
  lessons,
  durationMinutes,
  quizCount,
  lifetime,
}: {
  modules: number;
  lessons: number;
  durationMinutes: number | null;
  quizCount: number;
  lifetime: boolean;
}) {
  const facts: { icon: typeof Layers; label: string }[] = [];
  if (lessons > 1) {
    if (modules > 1) {
      facts.push({ icon: Layers, label: `${modules} modules` });
    }
    facts.push({ icon: BookOpen, label: `${lessons} leçons` });
  }
  if (durationMinutes) {
    facts.push({ icon: Clock, label: formatDuration(durationMinutes) });
  }
  if (quizCount > 0) {
    facts.push({ icon: ListChecks, label: `${quizCount} quiz` });
  }
  if (lifetime) facts.push({ icon: InfinityIcon, label: "Accès à vie" });
  facts.push({ icon: Smartphone, label: "Sur téléphone ou ordinateur" });

  return (
    <ul className="text-muted-foreground mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
      {facts.map(({ icon: Icon, label }) => (
        <li key={label} className="flex items-center gap-1.5">
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </li>
      ))}
    </ul>
  );
}

function OfferCard({
  title,
  price,
  struck = null,
  priceNote,
  extra = null,
  items,
  href,
  cta,
  highlighted,
}: {
  title: string;
  price: string;
  struck?: string | null;
  priceNote: string;
  extra?: string | null;
  items: string[];
  href: string;
  cta: string;
  highlighted: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-card flex flex-col rounded-3xl border p-6 sm:p-7",
        highlighted && "border-brand-accent/60 border-2 shadow-lg",
      )}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span className="text-3xl font-bold tabular-nums">{price}</span>
        {struck && (
          <span className="text-muted-foreground font-semibold tabular-nums line-through">
            {struck}
          </span>
        )}
        <span className="text-muted-foreground text-sm">{priceNote}</span>
      </p>
      {extra && <p className="text-muted-foreground mt-1 text-sm">{extra}</p>}
      <ul className="mt-5 mb-6 space-y-2.5 text-sm">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
            {item}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className={cn(
          buttonVariants({
            size: "lg",
            variant: highlighted ? "default" : "outline",
          }),
          highlighted && ACCENT_BUTTON,
          "mt-auto h-12 w-full text-base",
        )}
      >
        {cta}
      </Link>
    </div>
  );
}
