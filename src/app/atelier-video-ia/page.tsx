import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { Footer } from "@/app/_components/footer";
import { GridBackdrop } from "@/app/_components/grid-backdrop";
import { Navbar } from "@/app/_components/navbar";
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
function Section({
  title,
  muted,
  wide,
  children,
}: {
  title: string;
  muted?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={muted ? "bg-muted/40" : undefined}>
      <div
        className={cn(
          "mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8",
          !wide && "lg:grid lg:grid-cols-[2fr_3fr] lg:gap-14",
        )}
      >
        <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {title}
        </h2>
        <div
          className={cn("mt-5 space-y-4 leading-relaxed", !wide && "lg:mt-0")}
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
      <Navbar />
      <main className="pb-24 sm:pb-0">
        <section className="relative overflow-hidden">
          <GridBackdrop />
          <div className="relative mx-auto grid max-w-7xl items-center px-4 py-12 text-center sm:px-6 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:gap-x-16 lg:px-8 lg:py-10 lg:text-left">
            <div className="lg:col-start-1">
              <span className="text-primary bg-primary/10 inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                KINETIX AI VIDEO MASTERCLASS
              </span>
              <h1 className="font-heading mt-5 text-3xl leading-[1.15] font-semibold tracking-tight text-balance sm:text-5xl lg:text-[2.6rem]">
                En une matinée, crée une vraie pub vidéo avec l&apos;IA, et
                repars avec la méthode pour la vendre.
              </h1>
              <p className="mt-5 font-medium">
                Atelier pratique en présentiel à Lomé · Samedi 14 novembre ·{" "}
                <span className="whitespace-nowrap">8 h – 13 h</span>
              </p>
            </div>
            <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
              <ExampleVideos
                videos={workshop.exampleVideoUrls
                  .map(toExampleVideo)
                  .filter((video) => video !== null)}
              />
            </div>
            <div className="lg:col-start-1">
              <p className="mx-auto mt-5 max-w-2xl font-semibold text-pretty lg:mx-0">
                Tu arrives avec ton ordinateur ou ton téléphone. Tu repars avec
                une vidéo publicitaire terminée pour un vrai produit, et un plan
                pour trouver tes premiers clients.
              </p>
              <LaunchCountdown
                endsAt={workshop.startsAt.toISOString()}
                label="Temps restant avant l'atelier"
                className="mt-6 lg:justify-start"
                boxClassName="bg-card border"
                labelClassName="text-muted-foreground"
              />
              <div className="mt-6 flex flex-col items-center gap-3 lg:flex-row lg:gap-5">
                <WorkshopCta
                  label="JE RÉSERVE MA PLACE"
                  className="w-full sm:w-auto"
                />
                <p className="text-sm">
                  Seulement {workshop.capacity} places ·{" "}
                  <SeatsLeft className="inline" />
                </p>
              </div>
            </div>
          </div>
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

        <Section title="Cette formation est faite pour toi si…" muted wide>
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

        <Section title="Ce que tu vas réaliser">
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

        <Section title="Le programme de la matinée" muted>
          <ol className="border-primary/30 ml-1 space-y-5 border-l-2">
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
        </Section>

        <Section title="Ton formateur : Ehonam Afansi" muted>
          <p>
            Entrepreneur et consultant digital basé à Lomé, Ehonam forme depuis
            des années des jeunes africains aux compétences du numérique :
            création web, vibe coding, motion design et vidéo avec l&apos;IA. Il
            produit lui-même des spots publicitaires pour des applications, des
            logiciels et des produits alimentaires.
          </p>
          <p>
            C&apos;est d&apos;ailleurs{" "}
            <strong>l&apos;un de ses apprenants</strong> qui a eu l&apos;idée de{" "}
            <strong>Kinetix Africa</strong>, une plateforme qui rend ces
            formations accessibles au plus grand nombre.
          </p>
          <blockquote className="border-brand-accent border-l-4 pl-4 italic">
            « Je ne crois pas aux diplômes qui dorment dans un tiroir. Je crois
            aux compétences qui changent une vie. »
          </blockquote>
        </Section>

        <Section title="Ce que tu dois apporter">
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

        <Section title="Ton investissement" muted wide>
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
                  premium, guide de prompts, modèle d&apos;offre, suivi de 30
                  jours)
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
              <ul className="list-disc space-y-1 pl-5 text-sm sm:text-base">
                {INCLUDED.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p>
                🎁 <strong>Bonus :</strong> si tu rejoins Kinetix Africa le jour
                de l&apos;atelier,{" "}
                <strong>
                  tes {fmt(workshop.priceCfa)} F sont déduits de ton abonnement
                </strong>
                .
              </p>
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
              className="scroll-mt-20 pt-4 lg:sticky lg:top-24 lg:pt-0"
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
              Kinetix AI Video Masterclass · Animée par Ehonam Afansi · Kinetix
              Africa
            </p>
          </div>
        </section>
      </main>
      <StickyCta />
      <Footer />
    </WorkshopLiveProvider>
  );
}
