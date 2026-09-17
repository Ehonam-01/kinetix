import { CheckCircle2 } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "./reveal";

// Text colors here are hard-coded to white/amber rather than the theme's
// text-foreground/text-muted-foreground tokens — the section always sits on
// the same dark photo overlay regardless of light/dark site theme, same
// reasoning as final-cta.tsx's primary-gradient band. Only the third line
// carries the brand-accent color (never multiple words/lines at once) —
// see globals.css for why this is a separate token from --primary.
export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <Image
        src="/hero2.png"
        alt=""
        fill
        priority
        className="object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-b from-black/75 via-black/70 to-black/85"
      />

      <div className="relative mx-auto max-w-5xl px-4 py-24 text-center sm:px-6 sm:py-32 lg:px-8">
        <Reveal>
          <h1 className="text-shadow-lg text-shadow-black/60 text-4xl leading-[1.1] font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
            <span className="block">Les bonnes compétences.</span>
            <span className="block">Les bonnes personnes.</span>
            <span className="text-brand-accent block">
              Les bonnes opportunités.
            </span>
          </h1>
          <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-pretty text-white/80">
            Kinetix t&apos;aide à développer les compétences qui comptent,
            rencontrer les bonnes personnes et transformer ton potentiel en
            projets et opportunités.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
                "h-12 border-white/30 bg-white/5 px-6 text-base text-white hover:bg-white/10",
              )}
            >
              Découvrir la communauté
            </a>
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-white/70">
            <CheckCircle2 className="text-brand-accent size-4 shrink-0" />
            Formations pratiques. Mentorat réel. Une communauté qui avance.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
