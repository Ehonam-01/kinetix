import type { Metadata } from "next";
import Image from "next/image";
import { Caveat } from "next/font/google";
import { Check, ChevronDown } from "lucide-react";
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
  FAQS,
  INCLUDED,
  OUTCOMES,
  PROGRAM,
  TO_BRING,
} from "./_components/content";
import { ExampleVideos, type ExampleVideo } from "./_components/example-videos";
import { HeroVideo } from "./_components/hero-video";
import { RegistrationForm } from "./_components/registration-form";
import { RichText } from "./_components/rich-text";
import {
  CtaNote,
  StickyCta,
  WhatsappButton,
  WorkshopCta,
  WorkshopCtaBlock,
  WorkshopLiveProvider,
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

// Handwriting, for the note beside the hero video only.
const caveat = Caveat({ subsets: ["latin"], weight: "700" });

function toExampleVideo(url: string): ExampleVideo | null {
  const embedUrl = getVideoEmbedUrl("YOUTUBE", url);
  const id = embedUrl?.match(/\/embed\/([\w-]+)/)?.[1];
  if (!embedUrl || !id) return null;
  return {
    embedUrl,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}

// On a large screen the title sits beside its text, which keeps lines
// readable across the full width; "wide" gives the content the whole width
// for what lays out in columns by itself.
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
    "text-brand-accent text-xl leading-none sm:text-2xl lg:absolute lg:w-40 lg:text-3xl",
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

// The year-end occasions the section talks about, as stickers drifting
// up and down out of step (kx-bob in globals.css): a row on phones, a
// loose two-by-two pile under the title on large screens.
const EVENT_STICKERS = [
  {
    src: "/black-friday.png",
    alt: "Black Friday",
    width: 360,
    height: 360,
    tilt: "-rotate-6",
  },
  { src: "/noel.png", alt: "Noël", width: 352, height: 512, tilt: "rotate-3" },
  {
    src: "/promo.png",
    alt: "Spécial promo",
    width: 736,
    height: 736,
    tilt: "rotate-6",
  },
  {
    src: "/destockage.jpg",
    alt: "Déstockage",
    width: 400,
    height: 225,
    // A rectangle, not a cut-out: rounded like a label.
    tilt: "-rotate-3 rounded-xl shadow-lg",
  },
];

function EventStickers() {
  return (
    <div className="mx-auto mt-6 grid max-w-md grid-cols-4 items-center gap-3 lg:mx-0 lg:mt-8 lg:max-w-sm lg:grid-cols-2 lg:gap-6">
      {EVENT_STICKERS.map((sticker, i) => (
        <Image
          key={sticker.src}
          src={sticker.src}
          alt={sticker.alt}
          width={sticker.width}
          height={sticker.height}
          sizes="(min-width: 1024px) 11rem, 25vw"
          className={cn(
            "mx-auto max-h-20 w-auto object-contain motion-safe:animate-[kx-bob_4s_ease-in-out_infinite] sm:max-h-28 lg:max-h-36",
            sticker.tilt,
          )}
          style={{ animationDelay: `${-i * 1.1}s` }}
        />
      ))}
    </div>
  );
}

function Section({
  title,
  muted,
  wide,
  aside,
  centered,
  children,
}: {
  title: string;
  muted?: boolean;
  wide?: boolean;
  // Under the title: beside the text on large screens, above it otherwise.
  aside?: React.ReactNode;
  // Short content (lists, cards) centred on phones like the titles; long
  // prose stays left-aligned to stay readable.
  centered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={muted ? "bg-muted/40" : undefined}>
      <div
        className={cn(
          "mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8",
          !wide && "lg:grid lg:grid-cols-[2fr_3fr] lg:gap-14",
          aside && "lg:items-center",
        )}
      >
        <div className="text-center lg:text-left">
          <h2
            className={cn(
              "font-semibold tracking-tight text-balance",
              "text-2xl sm:text-3xl",
            )}
          >
            {title}
          </h2>
          {aside}
        </div>
        <div
          className={cn(
            "mt-5 space-y-4 leading-relaxed",
            !wide && "lg:mt-0",
            centered && "text-center lg:text-left",
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

export default async function AtelierVideoIaPage() {
  const [workshop, supportWhatsapp] = await Promise.all([
    getWorkshop(db),
    getSupportWhatsapp(db),
  ]);
  const { remaining, open } = await getWorkshopAvailability(db, workshop);
  const whatsappUrl = (text: string) =>
    supportWhatsapp ? whatsappHref(supportWhatsapp, text) : null;
  const waitlistUrl = whatsappUrl(
    "Bonjour, je ne peux pas venir à l'atelier du 14 novembre. Je souhaite être sur la liste d'attente pour les prochaines sessions.",
  );

  return (
    <WorkshopLiveProvider
      remaining={remaining}
      open={open}
      price={workshop.priceCfa}
      whatsappUrl={whatsappUrl(
        "Bonjour, je souhaite m'inscrire à l'atelier vidéo IA du 14 novembre.",
      )}
    >
      <main className="pb-24 sm:pb-0">
        <section className="relative overflow-hidden">
          <GridBackdrop />
          <div className="relative mx-auto max-w-6xl px-4 pt-10 pb-12 text-center sm:px-6 sm:pt-14 sm:pb-16 lg:px-8 lg:pt-8">
            <h1 className="font-heading text-3xl leading-[1.15] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-[2.75rem]">
              Crée ta première{" "}
              <span className="text-brand-accent">
                publicité vidéo professionnelle
              </span>{" "}
              avec l&apos;IA en une seule matinée.
            </h1>
            <p className="mx-auto mt-4 max-w-3xl font-medium text-pretty sm:text-lg">
              Apprends à produire des vidéos publicitaires pour les entreprises
              et découvre comment transformer cette compétence en source de
              revenus.
            </p>
            <span className="text-primary bg-primary/10 mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              KINETIX AI VIDEO MASTERCLASS
            </span>

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
                <div className="flex w-full flex-col items-center gap-2 sm:w-auto">
                  <WorkshopCta
                    label="JE RÉSERVE MA PLACE"
                    className="w-full sm:w-auto"
                  />
                  <CtaNote />
                </div>
              </div>
            </div>

            <p className="text-brand-accent mt-8 font-semibold">
              Atelier 100&nbsp;% pratique à Lomé
              <br />
              Samedi 14 novembre ·{" "}
              <span className="whitespace-nowrap">8 h – 13 h</span>
            </p>
          </div>
        </section>

        <section className="flex flex-col items-center px-4 sm:px-6 lg:px-8">
          <ExampleVideos
            videos={workshop.exampleVideoUrls
              .map(toExampleVideo)
              .filter((video) => video !== null)}
          />
          {/* A hand-drawn ring around the label, under the cards, drifting
              like them (kx-bob in globals.css). */}
          <p
            className={cn(
              caveat.className,
              "text-brand-accent border-brand-accent -mt-2 mb-14 -rotate-3 rounded-[50%] border-[3px] px-10 py-3 text-4xl leading-none motion-safe:animate-[kx-bob_4s_ease-in-out_infinite] sm:-mt-8 sm:mb-20 sm:px-14 sm:py-4 sm:text-6xl lg:mt-4",
            )}
          >
            Vidéos exemples
          </p>
        </section>

        <section>
          <div className="mx-auto max-w-3xl space-y-5 px-4 pb-12 text-center text-lg leading-relaxed text-pretty sm:px-6 sm:pb-16 sm:text-xl lg:px-8">
            <p>
              Imagine une boutique de vêtements à Lomé qui veut promouvoir ses
              nouveaux produits. Un restaurant qui veut attirer plus de clients.
              Un commerçant qui prépare une campagne spéciale pour les fêtes.
            </p>
            <p className="font-semibold">
              Tous ont besoin de vidéos publicitaires pour vendre davantage.
            </p>
            <p className="text-brand-accent text-xl font-bold sm:text-2xl">
              Et si tu étais capable de créer ces vidéos pour eux, sans caméra,
              sans studio et sans équipe de production ?
            </p>
          </div>
        </section>

        <Section
          title="Décembre arrive. Les entreprises vont toutes vouloir des vidéos."
          aside={<EventStickers />}
        >
          <p>
            Promotions de fin d&apos;année, offres de fêtes, nouveaux produits :
            dans quelques semaines, chaque boutique, restaurant et marque de
            Lomé voudra une vidéo pour attirer des clients sur Facebook, TikTok,
            Instagram et WhatsApp.
          </p>
          <p>
            Le problème : une pub vidéo coûtait jusqu&apos;ici du matériel, un
            studio, une équipe et beaucoup d&apos;argent.
          </p>
          <p>
            <strong>Ce n&apos;est plus le cas.</strong> Avec l&apos;intelligence
            artificielle, une seule personne bien formée peut produire en
            quelques heures ce qui demandait hier une équipe entière.
          </p>
          <p>
            La question est simple :{" "}
            <strong>
              cette fin d&apos;année, seras-tu celui qui regarde les pubs… ou
              celui qui les crée ?
            </strong>
          </p>
        </Section>

        <Section
          title="Cette formation est faite pour toi si…"
          muted
          wide
          centered
        >
          <div className="grid gap-4 lg:grid-cols-3">
            {AUDIENCES.map((audience) => (
              <div
                key={audience.title}
                className="bg-card rounded-2xl border p-5"
              >
                <h3 className="font-semibold">{audience.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  <RichText text={audience.text} />
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Ce que tu vas réaliser" centered>
          <p>
            Ce n&apos;est pas une conférence.{" "}
            <strong>Tu pratiques du début à la fin</strong>, sur un vrai projet
            : une pub vidéo pour un produit de ton choix (le tien, celui
            d&apos;un proche ou d&apos;un commerce que tu veux démarcher).
          </p>
          <p>À la fin de la matinée, tu auras :</p>
          <ul className="space-y-2">
            {OUTCOMES.map((outcome) => (
              <li key={outcome}>
                <RichText text={outcome} />
              </li>
            ))}
          </ul>
        </Section>

        <section className="bg-muted/40">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:grid lg:grid-cols-[auto_1fr] lg:items-center lg:gap-20 lg:px-8">
            {/* Read bottom to top beside the timeline on large screens. */}
            <h2 className="text-brand-accent text-center text-5xl leading-none font-extrabold tracking-tight uppercase sm:text-6xl lg:rotate-180 lg:text-8xl lg:[writing-mode:vertical-rl]">
              Programme
            </h2>
            <ol className="border-primary/30 mt-8 ml-1 space-y-5 border-l-2 lg:mt-0">
              {PROGRAM.map((step) => (
                <li key={step.time} className="relative pl-5">
                  <span
                    aria-hidden="true"
                    className="bg-primary absolute top-1.5 -left-[7px] size-3 rounded-full"
                  />
                  <p className="text-primary text-sm font-semibold">
                    {step.time}
                  </p>
                  <p className="text-sm sm:text-base">
                    <RichText text={step.text} />
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-muted/40">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <h2 className="text-foreground text-center text-3xl font-extrabold tracking-tight sm:text-5xl">
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
                  <p>
                    Il est convaincu que seules les compétences pourront nous
                    placer sur le chemin du succès.
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

        <Section title="Ce que tu dois apporter" centered>
          <ul className="space-y-2">
            {TO_BRING.map((item) => (
              <li key={item}>
                <RichText text={item} />
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-sm italic">
            Après ton inscription, tu recevras la liste des comptes gratuits à
            créer <strong>avant</strong> l&apos;atelier, pour ne perdre aucune
            minute le jour J.
          </p>
        </Section>

        <Section title="Ta participation à la masterclass" muted wide centered>
          <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-12">
            <div className="space-y-4">
              <div className="bg-card border-brand-accent/40 rounded-2xl border-2 p-6 text-center">
                <p className="text-muted-foreground text-sm">
                  Valeur de l&apos;atelier :{" "}
                  <span className="font-semibold line-through">
                    {fmt(workshop.regularPriceCfa)} F CFA
                  </span>
                </p>
                <p className="text-primary mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">
                  {fmt(workshop.priceCfa)} F CFA
                </p>
                <p className="bg-brand-accent text-brand-accent-foreground mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold tracking-wide uppercase">
                  🎁 Offert par Kinetix Africa
                </p>
                <p className="mt-4 text-sm sm:text-base">
                  Pour confirmer ta participation, seuls{" "}
                  <strong>{fmt(workshop.priceCfa)} F CFA</strong> de frais
                  d&apos;inscription sont demandés.
                </p>
              </div>
              <p className="font-semibold">Tu bénéficies de :</p>
              <ul className="mx-auto w-fit space-y-2 text-left text-sm sm:text-base lg:mx-0">
                {INCLUDED.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check
                      aria-hidden="true"
                      className="text-brand-accent mt-0.5 size-5 shrink-0"
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <p>💳 Paiement sécurisé en ligne par Mobile Money</p>
              <p>
                ⚠️ Les frais d&apos;inscription servent à confirmer ta présence
                : les places sont limitées à {workshop.capacity}.
              </p>
              <WorkshopCtaBlock />
              <p>📍 Lieu : {workshop.venue}</p>
            </div>

            <div
              id="inscription"
              className="scroll-mt-20 pt-4 text-left lg:sticky lg:top-24 lg:pt-0"
            >
              <RegistrationForm />
            </div>
          </div>
        </Section>

        <section>
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              Questions fréquentes
            </h2>
            {/* Two columns on large screens, each its own card: opening a
                question only pushes down its own column. */}
            <div className="mt-8 grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
              {[
                FAQS.slice(0, Math.ceil(FAQS.length / 2)),
                FAQS.slice(Math.ceil(FAQS.length / 2)),
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
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 sm:py-20 lg:px-8">
            <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-4xl">
              Les compétences d&apos;aujourd&apos;hui ouvrent les opportunités
              de demain.
            </h2>
            <p className="mt-4">
              En une matinée, tu peux savoir faire ce que la plupart des
              entreprises cherchent en ce moment.
            </p>
            <p className="mt-2">
              La seule question :{" "}
              <strong className="text-brand-accent">
                seras-tu dans la salle le 14 novembre ?
              </strong>
            </p>
            <WorkshopCta
              label="OUI, JE RÉSERVE MA PLACE"
              className="mt-7 w-full sm:w-auto"
            />
            <CtaNote className="mt-3" />
            <p className="mt-7 font-semibold">Apprends. Crée. Évolue.</p>
            <p className="text-muted-foreground mt-1 text-sm italic">
              Kinetix AI Video Masterclass
            </p>
          </div>
        </section>
      </main>
      <StickyCta />
    </WorkshopLiveProvider>
  );
}
