import type { Metadata } from "next";
import Image from "next/image";
import { Caveat } from "next/font/google";
import {
  Award,
  Briefcase,
  CalendarDays,
  Check,
  ChevronDown,
  Clapperboard,
  Coffee,
  FileText,
  Film,
  GraduationCap,
  ImagePlus,
  MapPin,
  MessageCircle,
  PenLine,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { GridBackdrop } from "@/app/_components/grid-backdrop";
import { LaunchCountdown } from "@/components/launch-countdown";
import { SITE_NAME } from "@/config/site";
import { db } from "@/db/client";
import { cn } from "@/lib/utils";
import { getVideoEmbedUrl } from "@/lib/video-embed";
import { whatsappHref } from "@/lib/whatsapp";
import { getSupportWhatsapp } from "@/repositories/payment-settings";
import { getWorkshop, getWorkshopAvailability } from "@/repositories/workshops";
import {
  AUDIENCES,
  INCLUDED,
  OUTCOMES,
  PROGRAM,
  SKILLS,
  WHATSAPP_REGISTER_TEXT,
  workshopFaqs,
} from "./_components/content";
import { ExampleVideos, type ExampleVideo } from "./_components/example-videos";
import { HeroVideo } from "./_components/hero-video";
import { PaymentLogos } from "./_components/payment-logos";
import { RichText } from "./_components/rich-text";
import { VideoSlider, type SliderVideo } from "./_components/video-slider";
import {
  CtaNote,
  HERO_CTA_ID,
  StickyCta,
  WhatsappButton,
  WorkshopCta,
  WorkshopCtaBlock,
  WorkshopLiveProvider,
  QuestionWhatsapp,
  QuestionWhatsappButton,
} from "./_components/workshop-live";

const TITLE = `Kinetix AI Video Masterclass — ${SITE_NAME}`;
const DESCRIPTION =
  "Crée ta première publicité vidéo professionnelle avec l'IA en une seule matinée, et découvre comment transformer cette compétence en source de revenus. Atelier 100 % pratique à Lomé, samedi 14 novembre, 8 h – 13 h.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/atelier-video-ia" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/atelier-video-ia",
    siteName: SITE_NAME,
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// Same reasoning as programme-ambassadeur/page.tsx. The seats themselves
// stay live in the browser (WorkshopLiveProvider).
export const revalidate = 60;

const fmt = (amount: number) => amount.toLocaleString("fr-FR");

// The date and hours as set in /admin/atelier, in Lomé time.
const fmtDay = (date: Date) =>
  date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Lome",
  });
function fmtHour(date: Date) {
  const [hours, minutes] = date
    .toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Lome",
    })
    .split(":");
  return `${Number(hours)} h${minutes === "00" ? "" : ` ${minutes}`}`;
}
const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

// Handwriting, for the notes beside the hero video and a few labels.
const caveat = Caveat({ subsets: ["latin"], weight: "700" });

function toSliderVideo(url: string): SliderVideo | null {
  const id = getVideoEmbedUrl("YOUTUBE", url)?.match(/\/embed\/([\w-]+)/)?.[1];
  return id
    ? { id, thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }
    : null;
}

function toExampleVideo(url: string): ExampleVideo | null {
  const embedUrl = getVideoEmbedUrl("YOUTUBE", url);
  const id = embedUrl?.match(/\/embed\/([\w-]+)/)?.[1];
  if (!embedUrl || !id) return null;
  return {
    embedUrl,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}

// A curved arrow, from its lower left to its upper right.
function HandArrow({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 80 60"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("hidden h-12 w-16 lg:block", className)}
    >
      <path d="M6 54 C 14 26, 38 10, 72 8" />
      <path d="M60 2 L 73 8 L 62 17" />
    </svg>
  );
}

// The two handwritten notes on either side of the video, each with an
// arrow. Side by side above the video on phones, where there's no room
// beside it.
function HandNotes() {
  const note = cn(
    caveat.className,
    "text-brand-accent max-w-36 text-lg leading-none sm:max-w-none sm:text-2xl lg:absolute lg:w-40 lg:text-3xl",
  );
  return (
    <div
      aria-hidden="true"
      className="mb-3 flex items-end justify-between gap-4 px-1 lg:contents"
    >
      <div className={cn(note, "-rotate-6 lg:top-[10%] lg:right-full lg:mr-3")}>
        <HandArrow className="ml-auto" />
        Atelier 100&nbsp;% pratique
      </div>
      <div className={cn(note, "-rotate-12 lg:top-[38%] lg:left-full lg:ml-2")}>
        Sur ordinateur ou téléphone
        {/* Turned round: its head points back at the video. */}
        <HandArrow className="mt-2 -ml-2 rotate-180" />
      </div>
    </div>
  );
}

// Date and hours, place, price: what a visitor needs to decide, as chips.
function EventInfo({
  when,
  venue,
  price,
  className,
}: {
  when: string;
  venue: string;
  price: string;
  className?: string;
}) {
  const items: { icon: LucideIcon; text: string; strong?: boolean }[] = [
    { icon: CalendarDays, text: when },
    { icon: MapPin, text: venue },
    { icon: Ticket, text: `${price} F CFA`, strong: true },
  ];
  return (
    <ul
      className={cn(
        "flex flex-wrap justify-center gap-2 text-sm sm:text-base",
        className,
      )}
    >
      {items.map(({ icon: Icon, text, strong }) => (
        <li
          key={text}
          className={cn(
            "bg-card flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-left",
            strong && "border-brand-accent/50 font-bold",
          )}
        >
          <Icon
            aria-hidden="true"
            className="text-brand-accent size-4 shrink-0"
          />
          {text}
        </li>
      ))}
    </ul>
  );
}

// A reserve button with its payment and seats line, centred.
function CtaRow({
  label = "JE RÉSERVE MA PLACE",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <WorkshopCta label={label} className="w-full sm:w-auto" />
      <CtaNote />
    </div>
  );
}

// A section with its title centred above the content.
function Block({
  title,
  intro,
  muted,
  children,
}: {
  title: string;
  intro?: React.ReactNode;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={muted ? "bg-muted/40" : undefined}>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {title}
        </h2>
        {intro && (
          <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-center text-pretty">
            {intro}
          </p>
        )}
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

// Icons for SKILLS and INCLUDED, in their order.
const SKILL_ICONS = [Clapperboard, PenLine, ImagePlus, Film, Briefcase];
const INCLUDED_ICONS = [
  GraduationCap,
  Clapperboard,
  Coffee,
  FileText,
  MessageCircle,
  Award,
];

export default async function AtelierVideoIaPage() {
  const [workshop, supportWhatsapp] = await Promise.all([
    getWorkshop(db),
    getSupportWhatsapp(db),
  ]);
  const { remaining, open } = await getWorkshopAvailability(db, workshop);
  const whatsappUrl = (text: string) =>
    supportWhatsapp ? whatsappHref(supportWhatsapp, text) : null;
  const sliderVideos = workshop.sliderVideoUrls
    .map(toSliderVideo)
    .filter((video) => video !== null);
  const exampleVideos = workshop.exampleVideoUrls
    .map(toExampleVideo)
    .filter((video) => video !== null);
  const questionUrl = whatsappUrl(
    "Bonjour, j'ai une question sur la Kinetix AI Video Masterclass avant de réserver ma place.",
  );
  const waitlistUrl = whatsappUrl(
    "Bonjour, je ne peux pas venir à l'atelier du 14 novembre. Je souhaite être sur la liste d'attente pour les prochaines sessions.",
  );

  const day = fmtDay(workshop.startsAt);
  const hours = `${fmtHour(workshop.startsAt)} – ${fmtHour(workshop.endsAt)}`;
  const when = `${capitalize(day)} · ${hours}`;
  const price = fmt(workshop.priceCfa);
  const eventInfo = { when, venue: workshop.venue, price };
  const faqs = workshopFaqs({
    price,
    venue: workshop.venue,
    date: `${day}, de ${hours}`,
  });

  return (
    <WorkshopLiveProvider
      remaining={remaining}
      open={open}
      price={workshop.priceCfa}
      whatsappUrl={whatsappUrl(WHATSAPP_REGISTER_TEXT)}
    >
      <main className="pb-24 sm:pb-0">
        {/* 1. The offer, at a glance. */}
        <section className="relative overflow-hidden">
          <GridBackdrop />
          <div className="relative mx-auto max-w-6xl px-4 pt-6 pb-12 text-center sm:px-6 sm:pt-12 sm:pb-16 lg:px-8 lg:pt-8">
            <p className="text-primary text-xs font-bold tracking-widest uppercase sm:text-sm">
              Kinetix AI Video Masterclass
            </p>
            <h1 className="font-heading mt-2 text-[1.6rem] leading-[1.12] font-extrabold tracking-tight text-balance sm:text-5xl sm:leading-[1.15] lg:text-[2.75rem]">
              En une matinée, crée une{" "}
              <span className="text-brand-accent">
                vraie publicité vidéo avec l&apos;IA
              </span>{" "}
              et repars avec la méthode pour la vendre.
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-[0.95rem] leading-snug font-medium text-pretty sm:mt-4 sm:text-lg sm:leading-normal">
              Atelier 100&nbsp;% pratique, accessible aux débutants : tu
              réalises ta propre pub, accompagné du début à la fin.
            </p>
            <EventInfo {...eventInfo} className="mt-4" />

            <div className="relative mx-auto mt-5 max-w-3xl lg:max-w-xl">
              <HandNotes />
              <HeroVideo
                video={
                  workshop.heroVideoUrl
                    ? toExampleVideo(workshop.heroVideoUrl)
                    : null
                }
              />
              <div className="mt-5 flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:justify-between">
                <LaunchCountdown
                  endsAt={workshop.startsAt.toISOString()}
                  label="Temps restant avant l'atelier"
                  boxClassName="bg-card border"
                  labelClassName="text-muted-foreground"
                />
                <div
                  id={HERO_CTA_ID}
                  className="flex w-full flex-col items-center gap-2 sm:w-auto"
                >
                  <WorkshopCta
                    label="JE RÉSERVE MA PLACE"
                    className="w-full sm:w-auto"
                  />
                  <CtaNote />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. What the morning produces. */}
        <Block
          title="Ce que tu vas réaliser"
          intro={
            <>
              Ce n&apos;est pas une conférence :{" "}
              <strong className="text-foreground">
                tu pratiques du début à la fin
              </strong>
              , sur une pub pour un produit de ton choix.
            </>
          }
        >
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {SKILLS.map((skill, i) => {
              const Icon = SKILL_ICONS[i];
              return (
                <li
                  key={skill}
                  className="bg-card flex items-center gap-3 rounded-2xl border p-4 lg:flex-col lg:p-5 lg:text-center"
                >
                  <span className="bg-brand-accent/15 text-brand-accent flex size-11 shrink-0 items-center justify-center rounded-xl">
                    <Icon aria-hidden="true" className="size-6" />
                  </span>
                  <span className="font-medium">{skill}</span>
                </li>
              );
            })}
          </ul>
          <div className="border-brand-accent/40 bg-card mx-auto mt-8 max-w-3xl rounded-2xl border-2 p-5 sm:p-6">
            <p className="text-center font-semibold">
              À la fin de la matinée, tu repars avec :
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {OUTCOMES.map((outcome) => (
                <li key={outcome} className="text-sm sm:text-base">
                  <RichText text={outcome} />
                </li>
              ))}
            </ul>
          </div>
        </Block>

        {/* 3. The proof: real videos made with AI. */}
        <section className="bg-muted/40 py-12 sm:py-16">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Des exemples de vidéos créées avec l&apos;IA
            </h2>
            <p className="text-muted-foreground mt-2">
              {sliderVideos.length > 0
                ? "Fais glisser, et appuie sur une vidéo pour l'écouter avec le son."
                : "Appuie sur une vidéo pour la regarder."}
            </p>
          </div>
          {sliderVideos.length > 0 ? (
            <div className="mt-8">
              <VideoSlider videos={sliderVideos} />
            </div>
          ) : (
            // No slider set: the three cards set for the top of the page.
            <div className="flex flex-col items-center px-4 sm:px-6 lg:px-8">
              <ExampleVideos videos={exampleVideos} />
              <p
                className={cn(
                  caveat.className,
                  "text-brand-accent border-brand-accent -mt-2 -rotate-3 rounded-[50%] border-[3px] px-10 py-3 text-4xl leading-none sm:-mt-8 sm:px-14 sm:py-4 sm:text-6xl lg:mt-4",
                )}
              >
                Vidéos exemples
              </p>
            </div>
          )}
          <CtaRow className="mt-10 px-4" />
        </section>

        {/* 4. Who it's for. */}
        <Block title="À qui s'adresse la masterclass ?">
          <div className="grid gap-4 lg:grid-cols-3">
            {AUDIENCES.map((audience) => (
              <div
                key={audience.title}
                className="bg-card rounded-2xl border p-5 text-center lg:text-left"
              >
                <h3 className="font-semibold">{audience.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm sm:text-base">
                  <RichText text={audience.text} />
                </p>
              </div>
            ))}
          </div>
        </Block>

        {/* 5. The programme, module by module. */}
        <Block title="Programme de la formation" muted>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {PROGRAM.map((module, i) => (
              <li
                key={module.title}
                className="bg-card relative rounded-2xl border p-5"
              >
                <span className="bg-primary text-primary-foreground inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase">
                  Module {i + 1}
                </span>
                <h3 className="mt-3 font-semibold">{module.title}</h3>
                <p className="text-muted-foreground mt-1.5 text-sm">
                  {module.text}
                </p>
              </li>
            ))}
          </ol>
          <p className="text-muted-foreground mt-6 text-center text-sm">
            ☕ Pause collation incluse. La matinée se termine par une
            présentation de Kinetix Africa.
          </p>
          <CtaRow className="mt-8" />
        </Block>

        {/* 6. The trainer. */}
        <section>
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              À propos du formateur
            </h2>
            <div className="mt-10 grid items-center gap-8 lg:grid-cols-[18rem_1fr] lg:gap-12">
              {/* The photo on an accent-coloured card, offset up and to the
                  right. */}
              <div className="relative mx-auto w-[70%] max-w-72 sm:w-72">
                <div
                  aria-hidden
                  className="bg-brand-accent absolute inset-0 translate-x-2.5 -translate-y-2.5 rounded-2xl"
                />
                <Image
                  src="/formateur-ehonam-afansi.jpg"
                  alt="Ehonam Afansi, formateur de la Kinetix AI Video Masterclass"
                  width={807}
                  height={1018}
                  sizes="(min-width: 640px) 18rem, 70vw"
                  className="relative w-full rounded-2xl object-cover shadow-lg"
                />
              </div>
              <div>
                <p
                  className={cn(
                    caveat.className,
                    "text-brand-accent -rotate-2 text-center text-4xl leading-none lg:text-left",
                  )}
                >
                  Ehonam AFANSI
                </p>
                <div className="mt-4 space-y-4 leading-relaxed">
                  <p>
                    Entrepreneur, consultant digital et passionné d&apos;IA,
                    Ehonam AFANSI forme depuis des années des jeunes africains
                    aux compétences du numérique : création web, vibe coding,
                    motion design et vidéo avec l&apos;IA. Il est le promoteur
                    de la plateforme de freelancing <strong>Edossimé</strong> et
                    de plusieurs autres outils numériques.
                  </p>
                  <blockquote className="border-brand-accent border-l-4 pl-4 italic">
                    « Je ne crois pas aux diplômes qui dorment dans un tiroir.
                    Je crois aux compétences qui changent une vie. »
                  </blockquote>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7. What the contribution includes. */}
        <Block title="Ce qui est inclus" muted>
          <ul className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INCLUDED.map((item, i) => {
              const Icon = INCLUDED_ICONS[i] ?? Check;
              return (
                <li
                  key={item}
                  className="bg-card flex items-center gap-3 rounded-2xl border p-4"
                >
                  <span className="bg-brand-accent/15 text-brand-accent flex size-10 shrink-0 items-center justify-center rounded-xl">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="font-medium">{item}</span>
                </li>
              );
            })}
          </ul>
        </Block>

        {/* 8. Price and booking. */}
        <Block title="Réserve ta place">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-12">
            <div className="bg-card border-brand-accent/40 rounded-2xl border-2 p-6 text-center">
              <p className="text-muted-foreground text-sm">
                Valeur de l&apos;atelier :{" "}
                <span className="font-semibold line-through">
                  {fmt(workshop.regularPriceCfa)} F CFA
                </span>
              </p>
              <p className="text-primary mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">
                {price} F CFA
              </p>
              <p className="bg-brand-accent text-brand-accent-foreground mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase">
                🎁 Formation prise en charge par Kinetix Africa
              </p>
              <p className="mt-4 text-sm sm:text-base">
                Kinetix Africa prend en charge le coût de cette formation
                pratique. Ta contribution de <strong>{price} F CFA</strong>{" "}
                couvre la réservation de ta place, la collation et
                l&apos;organisation de l&apos;atelier.
              </p>
              <EventInfo {...eventInfo} className="mt-5" />
            </div>

            <div className="space-y-4 text-center lg:text-left">
              <div className="space-y-3">
                <p>💳 Paiement sécurisé en ligne par Mobile Money</p>
                <PaymentLogos className="justify-center lg:justify-start" />
              </div>
              <p className="font-medium">
                ✅ Paiement possible en plusieurs fois, dès 1&nbsp;000&nbsp;F :
                ta place est réservée dès le premier versement.
              </p>
              <p>
                ⚠️ Les places sont limitées à {workshop.capacity} : ta
                contribution confirme ta présence.
              </p>
              <WorkshopCtaBlock />
              <p className="text-muted-foreground text-sm">
                Après ton paiement, ta place est réservée et tu reçois les
                informations pratiques ainsi que le lien du groupe WhatsApp des
                participants.
              </p>
            </div>
          </div>
        </Block>

        {/* 9. Objections. */}
        <section className="bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              Questions fréquentes
            </h2>
            {/* Two columns on large screens, each its own card: opening a
                question only pushes down its own column. */}
            <div className="mt-8 grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
              {[
                faqs.slice(0, Math.ceil(faqs.length / 2)),
                faqs.slice(Math.ceil(faqs.length / 2)),
              ].map((column, i) => (
                <div
                  key={i}
                  className="border-border divide-border bg-card divide-y rounded-2xl border"
                >
                  {column.map((faq) => (
                    <details key={faq.question} className="group p-5">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium marker:content-none [&::-webkit-details-marker]:hidden">
                        {faq.question}
                        <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-open:rotate-180" />
                      </summary>
                      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                        {faq.answer}
                      </p>
                      {faq.waitlist && waitlistUrl && (
                        <WhatsappButton
                          url={waitlistUrl}
                          label="Liste d'attente"
                          className="mt-3"
                        />
                      )}
                    </details>
                  ))}
                </div>
              ))}
            </div>
            {questionUrl && (
              <div className="mt-8 flex flex-col items-center gap-3 text-center">
                <p className="font-medium">
                  Tu as une autre question ? Écris-nous, on te répond.
                </p>
                <QuestionWhatsappButton url={questionUrl} />
              </div>
            )}
          </div>
        </section>

        {/* 10. Last call. */}
        <section>
          <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-20 lg:px-8">
            <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-4xl">
              En une matinée, crée ta première{" "}
              <span className="text-brand-accent">
                publicité vidéo avec l&apos;IA
              </span>
              .
            </h2>
            <p className="mt-3">
              Et repars avec la méthode pour vendre cette compétence aux
              entreprises.
            </p>
            <EventInfo {...eventInfo} className="mt-6" />
            <CtaRow label="OUI, JE RÉSERVE MA PLACE" className="mt-7" />
            <p className="mt-7 font-semibold">Apprends. Crée. Évolue.</p>
            <p className="text-muted-foreground mt-1 text-sm italic">
              Kinetix AI Video Masterclass
            </p>
          </div>
        </section>
      </main>
      <StickyCta />
      {questionUrl && <QuestionWhatsapp url={questionUrl} />}
    </WorkshopLiveProvider>
  );
}
