import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Briefcase,
  Camera,
  Check,
  GraduationCap,
  Layers,
  Megaphone,
  Network,
  Rocket,
  ShieldAlert,
  Sparkles,
  Store,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { db } from "@/db/client";
import { SITE_NAME } from "@/config/site";
import { getSiteEnv } from "@/config/env.site";
import { listActiveLevels } from "@/repositories/member-levels";
import {
  getCurrentParameterValue,
  getCurrentParameterValueOrNull,
} from "@/repositories/parameter-versions";
import { getCompensationData } from "@/app/programme-ambassadeur/data";
import { Logo } from "@/app/_components/logo";
import { Reveal } from "@/app/_components/reveal";
import { BinaryTree } from "./_components/binary-tree";
import { CountUp } from "./_components/count-up";
import { CtaLink, StickyMobileCta } from "./_components/cta-link";

const TITLE = "Programme Ambassadeur Kinetix-Africa | Développe ton réseau";
const DESCRIPTION =
  "Découvre le Programme Ambassadeur Kinetix-Africa : formations, accompagnement, recommandation, développement de réseau et commissions selon le plan de rémunération.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/businessplan" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/businessplan",
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

// Static, refreshed at most every 10 minutes and right away when an admin
// changes a price, a commission or a reward (their actions revalidate this
// path): every figure below is read from the same settings the platform
// pays with, never typed by hand.
export const revalidate = 600;

const F = (amount: number) => `${amount.toLocaleString("fr-FR")} FCFA`;

const GLASS =
  "rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-sm";
const EYEBROW =
  "text-xs font-semibold tracking-[0.2em] text-[#f5a524] uppercase";
const H2 =
  "text-3xl font-bold tracking-tight text-balance text-white sm:text-4xl lg:text-5xl";
const DISCLAIMER = "text-xs leading-relaxed text-[#8d9bbd]";

async function getPlan() {
  const [compensation, levels, price, regularPrice] = await Promise.all([
    getCompensationData(db),
    listActiveLevels(db),
    getCurrentParameterValue(db, "subscription.price_in_cfa"),
    getCurrentParameterValueOrNull(db, "subscription.regular_price_in_cfa"),
  ]);
  const plan = levels.map((level) => {
    const sizes = level.config.generationSizes;
    const comp = compensation.levels.find((l) => l.code === level.code);
    const perPerson =
      comp?.generation?.kind === "fixed" ? comp.generation.max : null;
    return {
      code: level.code,
      name: level.name,
      sizes,
      perPerson,
      total: perPerson ? sizes.reduce((s, n) => s + n * perPerson, 0) : null,
      reward: comp?.reward ?? null,
    };
  });
  return {
    price,
    regularPrice:
      regularPrice !== null && regularPrice > price ? regularPrice : null,
    directRate: compensation.directRatePercent,
    directExample: compensation.example?.commission ?? null,
    levels: plan,
    totalGenerations: plan.reduce((s, l) => s + l.sizes.length, 0),
    topLevel: plan.at(-1)?.code ?? 4,
  };
}

type Plan = Awaited<ReturnType<typeof getPlan>>;

export default async function BusinessPlanPage() {
  const plan = await getPlan();
  const siteUrl = getSiteEnv().SITE_URL;
  const faqs = buildFaqs(plan);

  return (
    <div className="bg-[#070b17] pb-24 text-[#dbe3f5] md:pb-0">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />

      <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-white/5 bg-[#070b17]/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            aria-label={SITE_NAME}
            className="rounded-lg bg-white px-2 py-1"
          >
            <Logo className="h-8" priority />
          </Link>
          <CtaLink
            siteUrl={siteUrl}
            className="hidden min-h-10 px-5 text-sm md:inline-flex"
          >
            Je deviens ambassadeur
          </CtaLink>
        </div>
      </header>

      <main>
        <Hero plan={plan} siteUrl={siteUrl} />
        <Problem />
        <Solution />
        <DirectCommission plan={plan} siteUrl={siteUrl} />
        <BinarySection siteUrl={siteUrl} />
        <Levels plan={plan} siteUrl={siteUrl} />
        <Generations plan={plan} />
        <WhatYouGet />
        <HowToStart />
        <ForWho />
        <Transparency plan={plan} />
        <Offer plan={plan} siteUrl={siteUrl} />
        <Faq faqs={faqs} siteUrl={siteUrl} />
        <FinalCta siteUrl={siteUrl} />
      </main>

      <footer className="border-t border-white/5 px-4 py-10 text-center text-xs text-[#8d9bbd]">
        <p>
          {SITE_NAME} · EXCELLENCIA GROUP LTD, Londres, Royaume-Uni ·{" "}
          <Link
            href="/conditions-utilisation"
            className="underline underline-offset-2"
          >
            Conditions d&apos;utilisation et de vente
          </Link>{" "}
          ·{" "}
          <Link
            href="/mentions-legales"
            className="underline underline-offset-2"
          >
            Mentions légales
          </Link>
        </p>
      </footer>

      <StickyMobileCta siteUrl={siteUrl} price={plan.price} />
    </div>
  );
}

function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28 ${className ?? ""}`}
    >
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

function PriceTag({ plan, large = false }: { plan: Plan; large?: boolean }) {
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
      <span
        className={`font-black tracking-tight text-white tabular-nums ${large ? "text-6xl sm:text-7xl" : "text-5xl sm:text-6xl"}`}
      >
        {plan.price.toLocaleString("fr-FR")}
        <span className="ml-2 text-2xl font-bold text-[#f5a524] sm:text-3xl">
          FCFA
        </span>
      </span>
      {plan.regularPrice && (
        <span className="pb-2 text-xl font-semibold text-[#8d9bbd] tabular-nums line-through">
          {F(plan.regularPrice)}
        </span>
      )}
    </div>
  );
}

function LaunchBadge({ label = "Tarif de lancement" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f5a524]/40 bg-[#f5a524]/10 px-3 py-1 text-xs font-bold tracking-widest text-[#f5a524] uppercase">
      <Sparkles className="size-3.5" />
      {label}
    </span>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────

function Hero({ plan, siteUrl }: { plan: Plan; siteUrl: string }) {
  return (
    <section className="relative overflow-hidden px-4 pt-14 pb-20 sm:px-6 sm:pt-20 sm:pb-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_10%,rgba(79,140,255,0.22),transparent),radial-gradient(40%_40%_at_90%_30%,rgba(245,165,36,0.16),transparent)]"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-7">
          <p className={EYEBROW}>Programme Ambassadeur Kinetix-Africa</p>
          <h1 className="text-4xl leading-[1.05] font-black tracking-tight text-balance text-white sm:text-5xl lg:text-6xl">
            Ton réseau peut devenir ton nouveau{" "}
            <span className="bg-linear-to-r from-[#f5a524] to-[#ffd27a] bg-clip-text text-transparent">
              levier de développement.
            </span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-pretty text-[#b7c3e0] sm:text-xl">
            Rejoins Kinetix-Africa, deviens Ambassadeur et développe ton réseau
            autour d&apos;une plateforme conçue pour apprendre, progresser et
            entreprendre dans le digital.
          </p>
          <p className="text-sm font-semibold tracking-wide text-white/90">
            Apprendre · Recommander · Développer son réseau · Être rémunéré
          </p>
          <div className="space-y-3">
            {plan.regularPrice && <LaunchBadge />}
            <PriceTag plan={plan} large />
            <p className="text-sm text-[#8d9bbd]">
              Abonnement annuel, sans renouvellement automatique. Payable en une
              fois ou en plusieurs versements.
            </p>
          </div>
          <div className="space-y-3">
            <CtaLink siteUrl={siteUrl} className="w-full sm:w-auto" />
            <p className={DISCLAIMER}>
              Accès au programme selon les conditions d&apos;adhésion et de
              rémunération en vigueur.
            </p>
          </div>
        </div>
        <HeroVisual plan={plan} />
      </div>
    </section>
  );
}

// A phone showing an abstract ambassador dashboard over a glowing network
// — no people, no banknotes.
function HeroVisual({ plan }: { plan: Plan }) {
  const dots = [
    [12, 18],
    [88, 12],
    [6, 62],
    [94, 58],
    [22, 92],
    [80, 90],
    [50, 4],
    [50, 98],
  ];
  return (
    <div className="relative mx-auto w-full max-w-sm" aria-hidden="true">
      <svg
        viewBox="0 0 100 100"
        className="absolute -inset-10 h-[calc(100%+5rem)] w-[calc(100%+5rem)] opacity-70"
      >
        {dots.map(([x, y], i) => (
          <g key={i}>
            <line
              x1="50"
              y1="50"
              x2={x}
              y2={y}
              stroke="#4f8cff"
              strokeOpacity="0.35"
              strokeWidth="0.3"
            />
            <circle
              cx={x}
              cy={y}
              r="1.4"
              fill={i % 3 === 0 ? "#f5a524" : "#4f8cff"}
            >
              <animate
                attributeName="opacity"
                values="0.4;1;0.4"
                dur={`${2.4 + i * 0.3}s`}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        ))}
      </svg>
      <div className="relative mx-auto w-64 rounded-[2.5rem] border border-white/15 bg-linear-to-b from-[#121a33] to-[#0b1124] p-3 shadow-[0_40px_80px_-30px_rgba(79,140,255,0.6)] sm:w-72">
        <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-white/15" />
        <div className="space-y-3 rounded-[1.9rem] bg-[#0a0f20] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#8d9bbd]">
              Mon espace ambassadeur
            </span>
            <span className="rounded-full bg-[#f5a524]/15 px-2 py-0.5 text-[10px] font-bold text-[#f5a524]">
              Exemple
            </span>
          </div>
          <div className="rounded-2xl bg-linear-to-br from-[#2a5bd7] to-[#4f8cff] p-3 text-white">
            <p className="text-[10px] opacity-80">Commission directe</p>
            <p className="text-xl font-black tabular-nums">
              {plan.directExample
                ? `+${plan.directExample.toLocaleString("fr-FR")} F`
                : "+20 %"}
            </p>
            <p className="text-[10px] opacity-80">
              pour 1 souscription recommandée
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 p-3">
            <p className="mb-2 text-[10px] text-[#8d9bbd]">
              Progression par niveaux
            </p>
            {plan.levels.map((l, i) => (
              <div
                key={l.code}
                className="mb-1.5 flex items-center gap-2 last:mb-0"
              >
                <span className="w-14 text-[10px] text-white/80">
                  Niveau {l.code}
                </span>
                <span className="h-1.5 flex-1 rounded-full bg-white/10">
                  <span
                    className="block h-full rounded-full bg-[#f5a524]"
                    style={{ width: `${[100, 70, 35, 10][i] ?? 10}%` }}
                  />
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 p-3">
            <Network className="size-4 text-[#4f8cff]" />
            <span className="text-[10px] text-white/80">
              Ton organisation se construit génération après génération
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Problem & solution ──────────────────────────────────────────────────

function Problem() {
  const assets = [
    "Un réseau WhatsApp",
    "Des amis et de la famille",
    "Des collègues",
    "Des contacts professionnels",
    "Une audience sur les réseaux sociaux",
  ];
  return (
    <Section className="bg-[#0a1022]">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <h2 className={H2}>
            Tu connais déjà des dizaines de personnes. Mais ton réseau
            travaille-t-il réellement pour toi&nbsp;?
          </h2>
        </Reveal>
        <Reveal delayMs={120}>
          <div className="space-y-5 text-lg leading-relaxed">
            <p>Comme beaucoup de monde, tu as sûrement déjà&nbsp;:</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {assets.map((a) => (
                <li
                  key={a}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-base"
                >
                  <Check className="size-4 shrink-0 text-[#f5a524]" />
                  {a}
                </li>
              ))}
            </ul>
            <p className="text-[#b7c3e0]">
              Mais ce réseau n&apos;a jamais été organisé autour d&apos;une
              activité de recommandation. Le Programme Ambassadeur te donne un
              <strong className="text-white"> cadre structuré</strong> pour le
              faire : une plateforme à présenter, des règles claires et une
              progression par niveaux.
            </p>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

function Solution() {
  const cards = [
    {
      icon: GraduationCap,
      title: "Apprendre",
      text: "Accède aux formations de la plateforme pour progresser dans le digital et l'entrepreneuriat.",
    },
    {
      icon: Megaphone,
      title: "Recommander",
      text: "Présente Kinetix-Africa à ton entourage avec ton lien personnel d'ambassadeur.",
    },
    {
      icon: Network,
      title: "Développer",
      text: "Construis ton organisation dans une structure binaire, accompagne les personnes qui te rejoignent.",
    },
    {
      icon: TrendingUp,
      title: "Progresser",
      text: "Avance de niveau en niveau, avec des commissions et des récompenses prévues par le plan.",
    },
  ];
  return (
    <Section>
      <Reveal>
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <p className={EYEBROW}>La solution</p>
          <h2 className={H2}>
            Découvre le Programme Ambassadeur Kinetix-Africa
          </h2>
        </div>
      </Reveal>
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <Reveal key={c.title} delayMs={i * 90}>
            <div
              className={`${GLASS} h-full space-y-4 p-6 transition-colors hover:border-[#f5a524]/40`}
            >
              <span className="flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-[#f5a524]/25 to-[#4f8cff]/20 text-[#f5a524]">
                <c.icon className="size-6" />
              </span>
              <h3 className="text-lg font-bold tracking-wide text-white uppercase">
                {c.title}
              </h3>
              <p className="text-sm leading-relaxed text-[#b7c3e0]">{c.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ─── Direct commission ───────────────────────────────────────────────────

function DirectCommission({ plan, siteUrl }: { plan: Plan; siteUrl: string }) {
  const rate = plan.directRate ?? 20;
  const example = plan.directExample ?? Math.floor((plan.price * rate) / 100);
  return (
    <Section className="bg-[#0a1022]">
      <div
        className={`${GLASS} grid items-center gap-10 overflow-hidden p-8 sm:p-12 lg:grid-cols-[0.8fr_1.2fr]`}
      >
        <Reveal>
          <div className="text-center lg:text-left">
            <p className="bg-linear-to-br from-[#ffd27a] to-[#f5a524] bg-clip-text text-8xl font-black text-transparent sm:text-9xl">
              <CountUp value={rate} suffix=" %" />
            </p>
            <p className="mt-2 text-2xl font-bold text-white">
              Commission directe
            </p>
          </div>
        </Reveal>
        <Reveal delayMs={120}>
          <div className="space-y-6">
            <p className="text-lg leading-relaxed">
              Lorsqu&apos;une personne souscrit à Kinetix-Africa grâce à ta
              recommandation, tu peux percevoir une commission directe de {rate}{" "}
              %, conformément au plan de rémunération.
            </p>
            <div className="rounded-2xl border border-[#f5a524]/30 bg-[#f5a524]/5 p-5 font-mono text-lg text-white sm:text-xl">
              {plan.price.toLocaleString("fr-FR")} FCFA × {rate} % ={" "}
              <strong className="text-[#f5a524]">{F(example)}</strong>
            </div>
            <p className={DISCLAIMER}>
              Exemple illustratif basé sur le tarif de lancement. Les
              commissions réelles dépendent des conditions du plan et de
              l&apos;éligibilité de la souscription : elle est versée sur la
              première souscription de la personne recommandée, à condition que
              ton propre abonnement soit valide.
            </p>
            <CtaLink siteUrl={siteUrl} className="w-full sm:w-auto" />
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

// ─── Binary structure ────────────────────────────────────────────────────

function BinarySection({ siteUrl }: { siteUrl: string }) {
  return (
    <Section>
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <div className="space-y-5">
            <p className={EYEBROW}>Le système binaire</p>
            <h2 className={H2}>Deux branches. Une organisation qui grandit.</h2>
            <p className="text-lg leading-relaxed">
              Une structure binaire comporte{" "}
              <strong className="text-white">deux branches directes</strong>{" "}
              sous chaque membre.
            </p>
            <p className="leading-relaxed text-[#b7c3e0]">
              Lorsqu&apos;une nouvelle personne est inscrite et que tes deux
              positions directes sont déjà occupées, elle est positionnée plus
              bas dans ta structure, du côté de la branche la moins remplie,
              conformément aux règles du plan. Chaque nouvelle ligne de membres
              forme une génération.
            </p>
            <CtaLink siteUrl={siteUrl} className="w-full sm:w-auto" />
          </div>
        </Reveal>
        <Reveal delayMs={120}>
          <div className={`${GLASS} p-4 sm:p-8`}>
            <BinaryTree />
            <p className="mt-2 text-center text-xs text-[#8d9bbd]">
              Toi, tes deux positions directes, puis deux positions sous chacune
              d&apos;elles, et ainsi de suite.
            </p>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

// ─── Levels ──────────────────────────────────────────────────────────────

function Levels({ plan, siteUrl }: { plan: Plan; siteUrl: string }) {
  return (
    <Section className="bg-[#0a1022]">
      <Reveal>
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <p className={EYEBROW}>La progression</p>
          <h2 className={H2}>Les {plan.levels.length} niveaux du programme</h2>
          <p className="text-[#b7c3e0]">
            Chaque niveau se valide lorsque les membres de tes générations le
            rejoignent à leur tour.
          </p>
        </div>
      </Reveal>
      <div className="mt-14 grid gap-5 md:grid-cols-2">
        {plan.levels.map((level, i) => (
          <Reveal key={level.code} delayMs={i * 80}>
            <LevelCard level={level} isTop={level.code === plan.topLevel} />
          </Reveal>
        ))}
      </div>
      <p className={`${DISCLAIMER} mx-auto mt-8 max-w-3xl text-center`}>
        Simulations mathématiques basées sur une organisation complète : elles
        ne constituent pas une garantie de revenu. Toutes les récompenses sont
        soumises aux conditions et critères d&apos;attribution du programme.
      </p>
      <div className="mt-8 text-center">
        <CtaLink siteUrl={siteUrl} className="w-full sm:w-auto" />
      </div>
    </Section>
  );
}

function LevelCard({
  level,
  isTop,
}: {
  level: Plan["levels"][number];
  isTop: boolean;
}) {
  return (
    <div
      className={`${GLASS} relative h-full space-y-5 overflow-hidden p-7 ${level.reward ? "border-[#f5a524]/30" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-[#8d9bbd] uppercase">
            Niveau {level.code} · {level.name}
          </p>
          <p className="mt-1 text-sm text-[#b7c3e0]">
            {level.sizes.length} générations à construire
          </p>
        </div>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-2xl font-black text-white">
          {level.code}
        </span>
      </div>

      {level.perPerson === null ? (
        <p className="text-lg leading-relaxed text-white">
          Construire les premières bases de ton organisation : tes{" "}
          {level.sizes.reduce((s, n) => s + n, 0)} premiers membres, sur{" "}
          {level.sizes.length} générations. La validation de ce niveau débloque
          le niveau {level.code + 1}.
        </p>
      ) : (
        <>
          <div>
            <p className="text-sm text-[#b7c3e0]">Commission annoncée</p>
            <p className="text-4xl font-black text-white tabular-nums">
              {F(level.perPerson)}
            </p>
            <p className="text-sm text-[#b7c3e0]">
              par membre éligible qui rejoint le niveau {level.code},
              conformément au plan.
            </p>
          </div>
          <div className="space-y-1 rounded-2xl bg-black/20 p-4 font-mono text-sm">
            {level.sizes.map((n) => (
              <p key={n} className="flex justify-between gap-3">
                <span>
                  {n} × {level.perPerson!.toLocaleString("fr-FR")}
                </span>
                <span className="text-white">{F(n * level.perPerson!)}</span>
              </p>
            ))}
            <p className="mt-2 flex justify-between gap-3 border-t border-white/10 pt-2 font-bold text-[#f5a524]">
              <span>Total illustratif</span>
              <span>{F(level.total!)}</span>
            </p>
          </div>
        </>
      )}

      {level.reward && (
        <div className="flex items-center gap-4 rounded-2xl border border-[#f5a524]/30 bg-[#f5a524]/5 p-3">
          {level.reward.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage public URL, same as the rest of the site
            <img
              src={level.reward.imageUrl}
              alt={level.reward.name}
              className="aspect-video w-28 shrink-0 rounded-xl object-cover"
            />
          ) : null}
          <div>
            <p className="text-xs font-bold tracking-widest text-[#f5a524] uppercase">
              Récompense à la validation
            </p>
            <p className="text-xl font-black text-white uppercase">
              {level.reward.name}
            </p>
            <p className="text-xs text-[#8d9bbd]">
              Selon les conditions d&apos;attribution du programme.
            </p>
          </div>
        </div>
      )}

      {isTop && (
        <p className="text-xs leading-relaxed text-[#8d9bbd]">
          Après ce dernier niveau, l&apos;ambassadeur obtient le rang
          d&apos;Ancêtre : il ne perçoit plus de nouvelles commissions, mais
          garde son accès tant que son abonnement est valide.
        </p>
      )}
    </div>
  );
}

// ─── Generations ─────────────────────────────────────────────────────────

function Generations({ plan }: { plan: Plan }) {
  const gens = Array.from({ length: plan.totalGenerations }, (_, i) => i + 1);
  let cursor = 0;
  const levelOf = gens.map(() => 0);
  plan.levels.forEach((l, i) => {
    for (let k = 0; k < l.sizes.length; k++) levelOf[cursor++] = i;
  });
  const tints = ["#4f8cff", "#7c6cff", "#c084fc", "#f5a524"];
  return (
    <Section>
      <Reveal>
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <p className={EYEBROW}>Ton organisation</p>
          <h2 className={H2}>
            Jusqu&apos;à {plan.totalGenerations} générations dans ton
            organisation
          </h2>
          <p className="text-[#b7c3e0]">
            Une génération correspond à une ligne de membres située à un niveau
            donné sous l&apos;organisation de l&apos;Ambassadeur.
          </p>
        </div>
      </Reveal>
      <Reveal delayMs={120}>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {gens.map((g, i) => (
            <div key={g} className="flex items-center gap-2 sm:gap-3">
              <span
                className="flex size-12 items-center justify-center rounded-2xl border text-sm font-black text-white sm:size-14"
                style={{
                  borderColor: `${tints[levelOf[i]]}80`,
                  background: `${tints[levelOf[i]]}1f`,
                }}
              >
                G{g}
              </span>
              {g < gens.length && <span className="text-[#4f8cff]/60">→</span>}
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs">
          {plan.levels.map((l, i) => (
            <span key={l.code} className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ background: tints[i] }}
              />
              Niveau {l.code} : {l.sizes.length} générations
            </span>
          ))}
        </div>
        <p className={`${DISCLAIMER} mx-auto mt-6 max-w-2xl text-center`}>
          Les générations décrivent la structure du plan. Elles ne constituent
          pas une garantie de revenus : les commissions dépendent des
          souscriptions réelles et de l&apos;activité éligible.
        </p>
      </Reveal>
    </Section>
  );
}

// ─── Benefits, steps, audience ───────────────────────────────────────────

function WhatYouGet() {
  const items = [
    "Accès à la plateforme Kinetix-Africa",
    "Les formations disponibles sur la plateforme",
    "L'accompagnement prévu par le programme (mentorat, communauté des membres)",
    "Le statut d'Ambassadeur et ton lien de parrainage personnel",
    "La possibilité de recommander la plateforme",
    "La possibilité de développer un réseau",
    "L'accès aux mécanismes de commissions prévus",
    "Une progression par niveaux, avec un certificat à chaque niveau validé",
    "La possibilité de bénéficier des récompenses prévues, selon les conditions",
  ];
  return (
    <Section className="bg-[#0a1022]">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal>
          <div className="space-y-4">
            <p className={EYEBROW}>Ton adhésion</p>
            <h2 className={H2}>Ce que tu obtiens</h2>
          </div>
        </Reveal>
        <Reveal delayMs={100}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <li
                key={item}
                className={`${GLASS} flex items-start gap-3 p-4 text-sm leading-relaxed`}
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <Check className="size-3.5" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </Section>
  );
}

function HowToStart() {
  const steps = [
    { n: "01", title: "Rejoins", text: "Inscris-toi à Kinetix-Africa." },
    {
      n: "02",
      title: "Apprends",
      text: "Découvre les formations et ressources disponibles.",
    },
    {
      n: "03",
      title: "Recommande",
      text: "Présente Kinetix-Africa à ton entourage.",
    },
    {
      n: "04",
      title: "Développe",
      text: "Construis et accompagne progressivement ton réseau.",
    },
  ];
  return (
    <Section>
      <Reveal>
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <p className={EYEBROW}>En 4 étapes</p>
          <h2 className={H2}>Comment commencer</h2>
        </div>
      </Reveal>
      <ol className="relative mt-14 grid gap-5 md:grid-cols-4">
        <span
          aria-hidden="true"
          className="absolute top-8 right-[12%] left-[12%] hidden h-px bg-linear-to-r from-[#4f8cff]/0 via-[#4f8cff]/50 to-[#f5a524]/0 md:block"
        />
        {steps.map((s, i) => (
          <Reveal key={s.n} delayMs={i * 90}>
            <li className="relative space-y-3 text-center">
              <span className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-[#f5a524]/40 bg-[#0d1530] text-xl font-black text-[#f5a524]">
                {s.n}
              </span>
              <h3 className="text-lg font-bold tracking-wide text-white uppercase">
                {s.title}
              </h3>
              <p className="text-sm text-[#b7c3e0]">{s.text}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}

function ForWho() {
  const profiles = [
    { icon: GraduationCap, label: "Étudiant" },
    { icon: Rocket, label: "Entrepreneur" },
    { icon: Briefcase, label: "Freelance" },
    { icon: Camera, label: "Créateur de contenu" },
    { icon: Store, label: "Commercial" },
    { icon: UserRound, label: "Salarié qui veut une activité complémentaire" },
  ];
  return (
    <Section className="bg-[#0a1022]">
      <Reveal>
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <p className={EYEBROW}>Pour qui ?</p>
          <h2 className={H2}>Ce programme est-il fait pour toi&nbsp;?</h2>
        </div>
      </Reveal>
      <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3">
        {profiles.map((p, i) => (
          <Reveal key={p.label} delayMs={i * 60}>
            <div
              className={`${GLASS} flex h-full flex-col items-center gap-3 p-5 text-center`}
            >
              <p.icon className="size-7 text-[#4f8cff]" />
              <p className="text-sm font-semibold text-white">{p.label}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal delayMs={200}>
        <p className="mx-auto mt-10 max-w-2xl text-center text-lg leading-relaxed text-white">
          Tu n&apos;as pas besoin d&apos;avoir une énorme audience pour
          commencer. Tu dois surtout être prêt à apprendre, communiquer et
          développer ton réseau.
        </p>
      </Reveal>
    </Section>
  );
}

// ─── Transparency, offer, FAQ, final CTA ─────────────────────────────────

function Transparency({ plan }: { plan: Plan }) {
  return (
    <Section>
      <Reveal>
        <div className="mx-auto max-w-4xl rounded-3xl border-2 border-[#f5a524]/40 bg-[#f5a524]/[0.06] p-8 sm:p-12">
          <div className="flex items-center gap-3">
            <ShieldAlert className="size-8 shrink-0 text-[#f5a524]" />
            <h2 className="text-2xl font-black tracking-tight text-white uppercase sm:text-3xl">
              Pas de promesse de revenu garanti
            </h2>
          </div>
          <p className="mt-5 text-lg leading-relaxed">
            Le Programme Ambassadeur est une activité de recommandation et de
            développement de réseau. Les commissions dépendent notamment des
            souscriptions et de l&apos;activité éligible conformément au plan de
            rémunération. Les exemples présentés sur cette page sont
            illustratifs et ne constituent pas une garantie de revenus.
          </p>
          <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            {[
              "Les commissions ne sont versées qu'aux ambassadeurs dont l'abonnement est valide.",
              "La commission directe porte sur la première souscription de la personne recommandée ; les renouvellements n'en génèrent pas.",
              `Après le niveau ${plan.topLevel}, le rang d'Ancêtre met fin aux nouvelles commissions.`,
              "Les récompenses sont attribuées selon les conditions et critères du programme.",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-[#f5a524]" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </Section>
  );
}

function Offer({ plan, siteUrl }: { plan: Plan; siteUrl: string }) {
  return (
    <Section id="offre" className="bg-[#0a1022]">
      <Reveal>
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-linear-to-br from-[#14224d] via-[#0d1530] to-[#1d1608] p-8 text-center sm:p-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 size-72 -translate-x-1/2 rounded-full bg-[#f5a524]/20 blur-3xl"
          />
          <div className="relative space-y-6">
            {plan.regularPrice && <LaunchBadge label="Offre de lancement" />}
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Rejoins Kinetix-Africa et le Programme Ambassadeur
            </h2>
            <div className="flex justify-center">
              <PriceTag plan={plan} large />
            </div>
            {plan.regularPrice && (
              <p className="text-[#b7c3e0]">
                Le tarif passera à {F(plan.regularPrice)} à la fin de la période
                de lancement.
              </p>
            )}
            <ul className="mx-auto grid max-w-md gap-2 text-left text-sm">
              {[
                "Abonnement annuel, sans renouvellement automatique",
                "Payable en une fois, ou en plusieurs versements sur 3 mois",
                "Paiement par mobile money",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-emerald-400" />
                  {t}
                </li>
              ))}
            </ul>
            <CtaLink
              siteUrl={siteUrl}
              className="w-full text-lg sm:w-auto sm:px-10"
            />
            <p className={DISCLAIMER}>
              Accès au programme selon les conditions d&apos;adhésion et de
              rémunération en vigueur.
            </p>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

type FaqItem = { q: string; a: string };

function buildFaqs(plan: Plan): FaqItem[] {
  const rate = plan.directRate ?? 20;
  const level2 = plan.levels.find((l) => l.code === 2);
  const level3 = plan.levels.find((l) => l.code === 3);
  const sizesText = plan.levels
    .map((l) => `${l.sizes.length} au niveau ${l.code}`)
    .join(", ");
  return [
    {
      q: "Qu'est-ce que le Programme Ambassadeur Kinetix-Africa ?",
      a: "C'est le programme qui permet aux membres de Kinetix-Africa de recommander la plateforme, de développer leur réseau et d'être rémunérés selon le plan de rémunération. Tu apprends sur la plateforme et, si tu le souhaites, tu la recommandes.",
    },
    {
      q: "Combien coûte l'adhésion ?",
      a: `L'abonnement annuel coûte ${F(plan.price)}. Il n'est pas renouvelé automatiquement : chaque année, tu choisis de le renouveler. Il est payable par mobile money, en une fois ou en plusieurs versements.`,
    },
    {
      q: `Pourquoi le tarif est-il de ${F(plan.price)} ?`,
      a: plan.regularPrice
        ? `C'est le tarif de lancement. Le tarif annoncé après la période de lancement est de ${F(plan.regularPrice)}.`
        : "C'est le tarif actuel de l'abonnement annuel, qui donne accès à toute la plateforme.",
    },
    {
      q: `Comment fonctionne la commission de ${rate} % ?`,
      a: `Quand une personne souscrit pour la première fois grâce à ta recommandation, tu peux percevoir ${rate} % de sa souscription, soit ${F(plan.directExample ?? Math.floor((plan.price * rate) / 100))} au tarif actuel. Il faut que ton propre abonnement soit valide. Les renouvellements ne génèrent pas de commission directe.`,
    },
    {
      q: "Qu'est-ce qu'une structure binaire ?",
      a: "Chaque membre a deux positions directes sous lui. Quand elles sont occupées, les nouvelles personnes sont placées plus bas dans la structure, du côté de la branche la moins remplie, selon les règles du plan.",
    },
    {
      q: "Qu'est-ce qu'une génération ?",
      a: "Une génération est une ligne de membres située à un niveau donné sous toi : la première génération, ce sont tes deux positions directes ; la deuxième, les quatre positions suivantes, et ainsi de suite.",
    },
    {
      q: "Combien de générations sont prises en compte ?",
      a: `Le plan s'étend sur ${plan.totalGenerations} générations au total : ${sizesText}.`,
    },
    {
      q: "Comment fonctionne le niveau 2 ?",
      a: level2?.perPerson
        ? `Au niveau 2, tu peux percevoir ${F(level2.perPerson)} par membre éligible de tes générations qui rejoint le niveau 2. Sur une organisation complète (${level2.sizes.join(" + ")} membres), cela représente ${F(level2.total!)} : c'est une simulation, pas une garantie.`
        : "Le niveau 2 se valide lorsque les membres de tes générations le rejoignent, selon le plan de rémunération.",
    },
    {
      q: "Comment fonctionne le niveau 3 ?",
      a: level3?.perPerson
        ? `Au niveau 3, tu peux percevoir ${F(level3.perPerson)} par membre éligible qui rejoint le niveau 3.${level3.reward ? ` La validation du niveau ouvre droit à la récompense prévue (${level3.reward.name.toLowerCase()}), selon les conditions du programme.` : ""}`
        : "Le niveau 3 se valide lorsque les membres de tes générations le rejoignent, selon le plan de rémunération.",
    },
    {
      q: "Quelles sont les conditions pour obtenir les récompenses ?",
      a: "Les récompenses sont liées à la validation complète d'un niveau et sont attribuées selon les conditions et critères du programme, dont un abonnement valide. Elles ne sont pas acquises automatiquement à l'inscription.",
    },
    {
      q: "Les revenus sont-ils garantis ?",
      a: "Non. Les commissions dépendent des souscriptions réelles et de l'activité éligible. Les exemples de cette page sont des simulations mathématiques, pas des promesses.",
    },
    {
      q: "Dois-je avoir une grande audience pour commencer ?",
      a: "Non. Il faut surtout être prêt à apprendre, à communiquer et à accompagner les personnes que tu recommandes.",
    },
    {
      q: "Que se passe-t-il après le dernier niveau ?",
      a: `Après le niveau ${plan.topLevel}, tu obtiens le rang d'Ancêtre : tu ne perçois plus de nouvelles commissions, mais tu gardes ton compte et tes formations tant que ton abonnement est valide.`,
    },
    {
      q: "Ai-je besoin d'un parrain pour m'inscrire ?",
      a: "Oui : l'inscription se fait avec le pseudo de la personne qui t'a présenté Kinetix-Africa. Si tu as reçu son lien, il est déjà renseigné.",
    },
  ];
}

function Faq({ faqs, siteUrl }: { faqs: FaqItem[]; siteUrl: string }) {
  return (
    <Section>
      <Reveal>
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <p className={EYEBROW}>Questions fréquentes</p>
          <h2 className={H2}>Tout comprendre avant de te lancer</h2>
        </div>
      </Reveal>
      <div className="mx-auto mt-12 max-w-3xl space-y-3">
        {faqs.map((f) => (
          <details
            key={f.q}
            className={`${GLASS} group p-5 open:border-[#f5a524]/30`}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-white">
              {f.q}
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/15 text-[#f5a524] transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 leading-relaxed text-[#b7c3e0]">{f.a}</p>
          </details>
        ))}
      </div>
      <div className="mt-10 text-center">
        <CtaLink siteUrl={siteUrl} className="w-full sm:w-auto" />
      </div>
    </Section>
  );
}

function FinalCta({ siteUrl }: { siteUrl: string }) {
  return (
    <section className="relative overflow-hidden px-4 py-24 sm:px-6 sm:py-32">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_100%,rgba(245,165,36,0.18),transparent),radial-gradient(50%_60%_at_50%_0%,rgba(79,140,255,0.18),transparent)]"
      />
      <Reveal>
        <div className="relative mx-auto max-w-3xl space-y-6 text-center">
          <Users className="mx-auto size-10 text-[#f5a524]" />
          <h2 className="text-3xl font-black tracking-tight text-balance text-white sm:text-5xl">
            Tu peux continuer à simplement utiliser ton réseau… ou commencer à
            le structurer.
          </h2>
          <p className="text-lg text-[#b7c3e0]">
            Rejoins Kinetix-Africa et découvre le Programme Ambassadeur.
          </p>
          <CtaLink
            siteUrl={siteUrl}
            className="w-full text-lg sm:w-auto sm:px-10"
          >
            Je rejoins Kinetix-Africa
          </CtaLink>
          <p className="flex items-center justify-center gap-2 text-xs text-[#8d9bbd]">
            <Layers className="size-3.5" />
            Les détails du plan figurent dans les conditions d&apos;utilisation
            et de vente.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
