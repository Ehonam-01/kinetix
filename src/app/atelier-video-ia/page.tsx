import type { Metadata } from "next";
import Image from "next/image";
import { Caveat } from "next/font/google";
import { ChevronDown } from "lucide-react";
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
  SeatsLeft,
  StickyCta,
  WhatsappButton,
  WorkshopCta,
  WorkshopLiveProvider,
} from "./_components/workshop-live";

const TITLE = `Kinetix AI Video Masterclass — ${SITE_NAME}`;
const DESCRIPTION =
  "En une matinée, crée une vraie pub vidéo avec l'IA, et repars avec la méthode pour la vendre. Atelier pratique en présentiel à Lomé, samedi 14 novembre, 8 h – 13 h.";

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
  // Under the title, with a smaller title: beside the text on large
  // screens, above it otherwise.
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
              aside ? "text-base sm:text-lg" : "text-2xl sm:text-3xl",
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
              En une matinée,{" "}
              <span className="text-brand-accent">
                crée une vraie pub vidéo
              </span>{" "}
              avec l&apos;IA, et repars avec la méthode pour la vendre.
            </h1>
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
                  <p className="text-xs">
                    Seulement {workshop.capacity} places ·{" "}
                    <SeatsLeft className="inline" />
                  </p>
                </div>
              </div>
            </div>

            <p className="text-brand-accent mt-8 font-semibold">
              Atelier pratique en présentiel à Lomé · Samedi 14 novembre ·{" "}
              <span className="whitespace-nowrap">8 h – 13 h</span>
            </p>
            <p className="mx-auto mt-4 max-w-3xl font-semibold text-pretty">
              Tu arrives avec ton ordinateur ou ton téléphone. Tu repars avec
              une vidéo publicitaire terminée pour un vrai produit, et un plan
              pour trouver tes premiers clients.
            </p>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8">
          <ExampleVideos
            videos={workshop.exampleVideoUrls
              .map(toExampleVideo)
              .filter((video) => video !== null)}
          />
        </section>

        <Section title="Décembre arrive. Les entreprises vont toutes vouloir des vidéos.">
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

        <Section
          title="Ton formateur : Ehonam Afansi"
          muted
          aside={
            // The photo on an accent-coloured card, offset up and to the right.
            <div className="relative mx-auto mt-4 w-[70%] max-w-72 sm:w-72 lg:mx-0">
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
          }
        >
          <p>
            Entrepreneur, consultant digital et passionné d&apos;IA, Ehonam
            AFANSI forme depuis des années des jeunes africains aux compétences
            du numérique : création web, vibe coding, motion design et vidéo
            avec l&apos;IA. Il est le promoteur de la plateforme de freelancing{" "}
            <strong>Edossimé</strong> et de plusieurs autres outils numériques.
          </p>
          <p>
            Il est convaincu que seules les compétences pourront nous placer sur
            le chemin du succès.
          </p>
          <blockquote className="border-brand-accent border-l-4 pl-4 italic">
            « Je ne crois pas aux diplômes qui dorment dans un tiroir. Je crois
            aux compétences qui changent une vie. »
          </blockquote>
        </Section>

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

        <Section title="Ton investissement" muted wide centered>
          <div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-12">
            <div className="space-y-4">
              <div className="bg-card rounded-2xl border p-5">
                <h3 className="text-lg font-semibold">
                  🎁 Formation offerte par Kinetix Africa
                </h3>
                <p className="mt-2 text-sm">
                  <strong>
                    Valeur :{" "}
                    <span className="line-through">
                      {fmt(workshop.regularPriceCfa)} F CFA
                    </span>
                  </strong>{" "}
                  (4 h de formation pratique, démonstrations d&apos;outils IA
                  premium, modèle d&apos;offre, suivi de 30 jours)
                </p>
                <p className="mt-4 text-lg font-semibold">
                  Seulement{" "}
                  <span className="text-primary text-2xl">
                    {fmt(workshop.priceCfa)} F CFA
                  </span>{" "}
                  de frais d&apos;inscription pour réserver ta place
                </p>
              </div>
              <p className="font-semibold">Ce qui est inclus :</p>
              <ul className="space-y-1 text-sm sm:text-base lg:list-disc lg:pl-5">
                {INCLUDED.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p>💳 Paiement sécurisé en ligne par Mobile Money</p>
              <p>
                ⚠️ Les frais d&apos;inscription servent à confirmer ta présence
                : les places sont limitées à {workshop.capacity}.
              </p>
              <WorkshopCta
                label="JE RÉSERVE MA PLACE MAINTENANT"
                className="w-full sm:w-auto"
              />
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

        <Section title="Questions fréquentes">
          <div className="border-border divide-border bg-card divide-y rounded-2xl border">
            {FAQS.map((faq) => (
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
        </Section>

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
              <strong>seras-tu dans la salle le 14 novembre ?</strong>
            </p>
            <WorkshopCta
              label="OUI, JE RÉSERVE MA PLACE"
              className="mt-7 w-full sm:w-auto"
            />
            <p className="mt-7 font-semibold">Apprends. Crée. Évolue.</p>
            <p className="text-muted-foreground mt-1 text-sm italic">
              Kinetix AI Video Masterclass · Ehonam Afansi · Kinetix Africa
            </p>
          </div>
        </section>
      </main>
      <StickyCta />
    </WorkshopLiveProvider>
  );
}
