import {
  BookOpen,
  CheckCircle2,
  Megaphone,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "./reveal";

// Split hero: copy on the left, a round portrait with floating cards on the
// right, pillars strip underneath. Always on the same dark blue background
// regardless of light/dark site theme, so text colors are hard-coded
// white/amber rather than theme tokens (same reasoning as final-cta.tsx).
// The floating cards illustrate what the platform feels like — they
// deliberately carry no member counts, earnings or other figures that
// would read as a factual claim.
const PILLARS = [
  { icon: BookOpen, label: "Formations pratiques" },
  { icon: Users, label: "Mentorat réel" },
  { icon: Sparkles, label: "Intelligence artificielle" },
  { icon: Video, label: "Communauté active" },
  { icon: Megaphone, label: "Programme ambassadeur" },
];

function ProgressCard() {
  const bars = [40, 65, 50, 80, 70, 95];
  return (
    <div className="w-44 rounded-2xl bg-white p-3.5 text-slate-900 shadow-2xl shadow-black/30">
      <p className="text-xs font-semibold">Ta progression</p>
      <p className="mt-0.5 text-[11px] text-slate-500">Marketing digital</p>
      <div className="mt-3 flex h-14 items-end gap-1.5">
        {bars.map((height, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-sm",
              i === bars.length - 1 ? "bg-brand-accent" : "bg-primary/25",
            )}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function LessonCard() {
  return (
    <div className="flex w-60 items-center gap-3 rounded-2xl bg-white p-3 text-slate-900 shadow-2xl shadow-black/30">
      <div className="bg-brand-accent/15 flex size-9 shrink-0 items-center justify-center rounded-full">
        <CheckCircle2 className="text-brand-accent size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold">Leçon terminée</p>
        <p className="truncate text-[11px] text-slate-500">
          Construire son business plan
        </p>
      </div>
    </div>
  );
}

function MentorCard() {
  return (
    <div className="w-48 rounded-2xl bg-white p-3.5 text-slate-900 shadow-2xl shadow-black/30">
      <p className="text-xs font-semibold">Session de mentorat</p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        Aujourd&apos;hui · 18h00
      </p>
      <div className="mt-3 flex items-center justify-between">
        <div className="flex -space-x-2">
          {["bg-primary", "bg-brand-accent", "bg-sky-400"].map((color) => (
            <span
              key={color}
              className={cn("size-6 rounded-full border-2 border-white", color)}
            />
          ))}
        </div>
        <span className="bg-primary rounded-full px-2.5 py-1 text-[10px] font-semibold text-white">
          Rejoindre
        </span>
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[oklch(0.2_0.07_262)]">
      {/* Background: deep brand blue with two soft glows. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-br from-[oklch(0.24_0.09_262)] via-[oklch(0.19_0.07_262)] to-[oklch(0.14_0.05_262)]"
      />
      <div
        aria-hidden="true"
        className="bg-primary/30 absolute -top-32 -left-32 size-96 rounded-full blur-3xl"
      />
      <div
        aria-hidden="true"
        className="bg-brand-accent/15 absolute right-0 bottom-0 size-96 rounded-full blur-3xl"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pt-16 pb-12 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:gap-8 lg:px-8 lg:pt-24 lg:pb-16">
        <Reveal>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/80">
            <span className="bg-brand-accent size-1.5 rounded-full" />
            Formations · Mentorat · Communauté
          </p>
          <h1 className="mt-6 text-4xl leading-[1.08] font-semibold tracking-tight text-white sm:text-5xl lg:text-[2.6rem] xl:text-[2.9rem]">
            <span className="block">Les bonnes compétences.</span>
            <span className="block">Les bonnes personnes.</span>
            <span className="text-brand-accent block">
              Les bonnes opportunités.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-white/75">
            Kinetix t&apos;aide à développer les compétences qui comptent,
            rencontrer les bonnes personnes et transformer ton potentiel en
            projets et opportunités.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="/register"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90 h-12 px-6 text-base",
              )}
            >
              Rejoindre Kinetix
            </a>
            <a
              href="#communaute"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 border-white/30 bg-white/5 px-6 text-base text-white hover:bg-white/10 hover:text-white",
              )}
            >
              Découvrir la communauté
            </a>
          </div>
        </Reveal>

        <Reveal delayMs={150} className="relative mx-auto w-full max-w-md">
          <div className="relative aspect-square">
            {/* Accent ring behind the portrait. */}
            <div
              aria-hidden="true"
              className="border-brand-accent/60 absolute inset-0 rounded-full border-2"
            />
            <div
              aria-hidden="true"
              className="bg-brand-accent/90 absolute inset-6 rounded-full"
            />
            <div className="absolute inset-8 overflow-hidden rounded-full ring-4 ring-white/10">
              {/* Square crop of community-photo.png centered on one member. */}
              <Image
                src="/hero-portrait.jpg"
                alt="Une membre de la communauté Kinetix Africa, souriante, carnet à la main"
                fill
                priority
                sizes="(min-width: 1024px) 28rem, 90vw"
                className="object-cover"
              />
            </div>

            {/* Floating cards — hidden on the narrowest screens, where they
                would cover the portrait. */}
            <div className="absolute top-4 -left-4 hidden sm:block lg:-left-10">
              <ProgressCard />
            </div>
            <div className="absolute top-1/2 -right-4 hidden sm:block xl:-right-8">
              <LessonCard />
            </div>
            <div className="absolute bottom-2 left-2 hidden sm:block lg:-left-6">
              <MentorCard />
            </div>
          </div>
        </Reveal>
      </div>

      {/* Pillars strip — the reference design's partner-logo row, filled
          with what Kinetix actually offers rather than invented logos. */}
      <div className="relative border-t border-white/10">
        <ul className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-4 py-6 sm:px-6 lg:justify-between lg:px-8">
          {PILLARS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-2 text-sm font-medium text-white/70"
            >
              <Icon className="text-brand-accent size-4" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
