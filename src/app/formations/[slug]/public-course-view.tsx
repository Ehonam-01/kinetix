import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  Infinity as InfinityIcon,
  Layers,
  ListChecks,
  Share2,
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
import { CourseReviews } from "@/components/course/course-reviews";
import { ShareCourse } from "@/components/course/share-course";
import { StarRatingDisplay } from "@/components/star-rating";
import { formatPrice } from "@/lib/format-price";
import { getVideoEmbedUrl } from "@/lib/video-embed";
import { HERO_CTA_ID, StickyBuyBar } from "./sticky-buy-bar";
import { CoursePreviewVideo } from "./course-preview-video";
import { PublicCourseOutline } from "./public-course-outline";

export type PublicCourseContent = NonNullable<
  Awaited<ReturnType<typeof getPublicCourse>>
>;

const ACCENT_BUTTON =
  "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90";

const CARD = "bg-card rounded-2xl border p-5 sm:p-6";
const CARD_TITLE = "text-xl font-semibold";

const SUBSCRIPTION_INCLUDES = [
  "Tout le catalogue de formations, à ton rythme",
  "Les mentors et la communauté des membres",
  "Des quiz pour valider chaque étape",
  "Sans engagement : aucun renouvellement automatique",
];

// What a visitor sees of a formation — a sales page (explicit user
// decision), laid out like the course pages people already know: a dark
// header (title, rating, what it is), a buy card on the right that follows
// the scroll (preview video, price, button, what's included), then what it
// teaches and for whom, the programme by module, reviews, the two ways in
// (this course alone, or the subscription) side by side, and the FAQ. Kept apart from page.tsx (data, metadata, redirects) so it
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

  // The first paragraph of the description sits in the header; a longer
  // description's rest gets its own block further down.
  const [lead = "", ...restParagraphs] = (course.description ?? "")
    .trim()
    .split(/\n\s*\n/);
  const details = restParagraphs.join("\n\n").trim();
  const videoCount = lessons.filter((l) => l.lessonType === "VIDEO").length;
  const headerFacts = [
    lessons.length > 1 && content.modules.length > 1
      ? `${content.modules.length} modules`
      : null,
    lessons.length > 1 ? `${lessons.length} leçons` : null,
    course.durationMinutes ? formatDuration(course.durationMinutes) : null,
  ].filter((fact): fact is string => fact !== null);

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

      <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-12 sm:px-6 lg:px-8 lg:pb-16">
        <Link
          href="/formations"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" />
          Toutes les formations
        </Link>

        {/* Two columns on a wide screen: the course on the left, the way
            in (video, price, button) on the right and following the
            scroll. On phones the same blocks stack: header, way in, then
            the rest. */}
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start lg:gap-8">
          <header className="rounded-3xl bg-neutral-900 p-6 text-white sm:p-8 lg:col-start-1 dark:border dark:border-white/10">
            {course.category && (
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
                {course.category}
              </span>
            )}
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {course.title}
            </h1>
            {rating && rating.count > 0 && (
              <a
                href="#avis"
                className="mt-3 inline-flex items-center gap-2 text-sm"
              >
                <span className="font-bold text-amber-400 tabular-nums">
                  {rating.average.toLocaleString("fr-FR", {
                    maximumFractionDigits: 1,
                  })}
                </span>
                <StarRatingDisplay rating={rating.average} />
                <span className="text-white/70 underline underline-offset-4">
                  ({rating.count} avis)
                </span>
              </a>
            )}
            {lead && (
              <p className="mt-4 leading-relaxed text-pretty whitespace-pre-line text-white/85 sm:text-lg">
                {lead}
              </p>
            )}
            <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/70">
              {headerFacts.map((fact, i) => (
                <span key={fact} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden="true">·</span>}
                  {fact}
                </span>
              ))}
              <a
                href="#partager"
                className="ml-auto inline-flex items-center gap-1.5 text-white hover:underline"
              >
                <Share2 aria-hidden="true" className="size-4" />
                Partager
              </a>
            </p>
          </header>

          <aside className="lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div className="bg-card overflow-hidden rounded-3xl border shadow-lg">
              {videoSrc ? (
                <CoursePreviewVideo
                  embedUrl={videoSrc}
                  thumbnailUrl={course.thumbnailUrl}
                  courseTitle={course.title}
                  className=""
                />
              ) : (
                <CourseCover
                  title={course.title}
                  thumbnailUrl={course.thumbnailUrl}
                />
              )}
              <div className="p-5 sm:p-6">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    salePrice !== null
                      ? "bg-brand-accent/15 text-brand-accent"
                      : "bg-emerald-500/10 text-emerald-600",
                  )}
                >
                  {salePrice !== null
                    ? "Un seul paiement · accès à vie"
                    : "Incluse dans l'abonnement"}
                </span>
                <p className="mt-3 flex flex-wrap items-baseline gap-x-2.5">
                  <span className="text-3xl font-bold tabular-nums">
                    {mainPrice}
                  </span>
                  {struckPrice !== null && (
                    <span className="text-muted-foreground text-lg font-semibold tabular-nums line-through">
                      {formatPrice(struckPrice)}
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground text-sm">
                  {salePrice !== null
                    ? "pour cette formation, sans abonnement"
                    : `par an, pour tout le catalogue ${SITE_NAME}`}
                </p>

                <Link
                  id={HERO_CTA_ID}
                  href={mainHref}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    ACCENT_BUTTON,
                    "mt-5 h-12 w-full text-base",
                  )}
                >
                  {mainLabel}
                </Link>
                <p className="text-muted-foreground mt-3 flex items-center justify-center gap-1.5 text-xs">
                  <ShieldCheck aria-hidden="true" className="size-4" />
                  Paiement sécurisé par mobile money
                </p>

                <div className="mt-4 flex flex-col items-center gap-2 text-center text-sm">
                  {salePrice !== null && (
                    <a
                      href="#offres"
                      className="text-primary underline underline-offset-4"
                    >
                      Ou incluse dans l&apos;abonnement {SITE_NAME}
                    </a>
                  )}
                  <Link
                    href={memberHref}
                    className="text-muted-foreground hover:text-foreground underline underline-offset-4"
                  >
                    Déjà membre ou déjà achetée ? Accéder
                  </Link>
                </div>

                <div className="mt-5 border-t pt-5">
                  <p className="text-sm font-semibold">
                    Cette formation comprend
                  </p>
                  <CourseFacts
                    modules={content.modules.length}
                    lessons={lessons.length}
                    videos={videoCount}
                    durationMinutes={course.durationMinutes}
                    quizCount={quizCount}
                    lifetime={salePrice !== null}
                  />
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-6 lg:col-start-1">
            {course.learningOutcomes.length > 0 && (
              <section className={CARD}>
                <h2 className={CARD_TITLE}>Ce que tu vas apprendre</h2>
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
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
              <section className={CARD}>
                <h2 className={CARD_TITLE}>Pour qui ?</h2>
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {course.targetAudience.map((item) => (
                    <li
                      key={item}
                      className="bg-muted/40 flex items-start gap-3 rounded-xl p-3"
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

            {details && (
              <section className={CARD}>
                <h2 className={CARD_TITLE}>À propos de la formation</h2>
                <p className="text-muted-foreground mt-4 leading-relaxed whitespace-pre-line">
                  {details}
                </p>
              </section>
            )}

            <section className={CARD}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className={CARD_TITLE}>Le programme</h2>
                {lessons.length > 0 && (
                  <p className="text-muted-foreground text-sm">
                    {[
                      content.modules.length > 1
                        ? `${content.modules.length} modules`
                        : null,
                      `${lessons.length} leçon${lessons.length > 1 ? "s" : ""}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
              <p className="text-muted-foreground mt-1 text-sm">
                {salePrice !== null
                  ? "Les leçons s'ouvrent aux abonnés et à celles et ceux qui ont acheté cette formation."
                  : "Les leçons s'ouvrent aux membres abonnés."}
              </p>
              <div className="mt-5">
                {lessons.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Le programme sera bientôt en ligne.
                  </p>
                ) : (
                  <PublicCourseOutline lessons={lessons} />
                )}
              </div>
            </section>

            {rating && rating.count > 0 && (
              <CourseReviews
                id="avis"
                summary={rating}
                reviews={reviews}
                visible={3}
                className="scroll-mt-24"
              />
            )}

            <section id="offres" className={cn(CARD, "scroll-mt-24")}>
              <h2 className={CARD_TITLE}>
                {salePrice !== null
                  ? "Choisis ta formule"
                  : "Accède à cette formation"}
              </h2>
              <div
                className={cn(
                  "mt-5 grid gap-5",
                  salePrice !== null && "md:grid-cols-2",
                )}
              >
                {salePrice !== null && (
                  <OfferCard
                    highlighted
                    title="Cette formation seule"
                    price={formatPrice(salePrice)}
                    struck={
                      struckPrice !== null ? formatPrice(struckPrice) : null
                    }
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
                <h2 className={CARD_TITLE}>Questions fréquentes</h2>
                <div className="mt-4 space-y-3">
                  {course.faq.map((item) => (
                    <details
                      key={item.question}
                      className="bg-card group rounded-2xl border p-4 sm:p-5"
                    >
                      <summary className="cursor-pointer list-none font-medium marker:hidden">
                        <span className="flex items-start justify-between gap-4">
                          {item.question}
                          <ChevronDown
                            aria-hidden="true"
                            className="text-muted-foreground size-5 shrink-0 transition-transform group-open:rotate-180"
                          />
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

            <div id="partager" className="scroll-mt-24 pb-20 sm:pb-0">
              <ShareCourse url={shareUrl} courseTitle={course.title} />
            </div>
          </div>
        </div>
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

// What the course holds, in the buy card. "1 module · 1 leçon" says
// "thin" more than it informs, so the counts only show from 2 lessons up.
function CourseFacts({
  modules,
  lessons,
  videos,
  durationMinutes,
  quizCount,
  lifetime,
}: {
  modules: number;
  lessons: number;
  videos: number;
  durationMinutes: number | null;
  quizCount: number;
  lifetime: boolean;
}) {
  const facts: { icon: typeof Layers; label: string }[] = [];
  if (lessons > 1) {
    if (modules > 1) {
      facts.push({ icon: Layers, label: `${modules} modules` });
    }
    facts.push({
      icon: BookOpen,
      label:
        videos === lessons
          ? `${lessons} leçons en vidéo`
          : videos > 0
            ? `${lessons} leçons, dont ${videos} en vidéo`
            : `${lessons} leçons`,
    });
  }
  if (durationMinutes) {
    facts.push({ icon: Clock, label: formatDuration(durationMinutes) });
  }
  if (quizCount > 0) {
    facts.push({
      icon: ListChecks,
      label: `${quizCount} quiz pour valider tes acquis`,
    });
  }
  facts.push({
    icon: InfinityIcon,
    label: lifetime ? "Accès à vie" : "Accès tant que ton abonnement court",
  });
  facts.push({ icon: Smartphone, label: "Sur téléphone ou ordinateur" });

  return (
    <ul className="mt-3 space-y-2.5 text-sm">
      {facts.map(({ icon: Icon, label }) => (
        <li key={label} className="flex items-start gap-2.5">
          <Icon
            aria-hidden="true"
            className="text-muted-foreground mt-0.5 size-4 shrink-0"
          />
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
