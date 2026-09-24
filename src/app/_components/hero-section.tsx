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
        // hero2.png is a wide 16:9 shot with the Kinetix logo/tagline baked
        // into the top band. On a narrow mobile viewport the section is
        // much taller than wide, so object-cover's default center crop
        // shows the image's full height through a narrow column that lands
        // right on that logo band — object-left here shifts that column to
        // the clean office/plants side instead, sm+ reverts to the
        // centered crop the wider desktop hero was designed around.
        className="object-left sm:object-center"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-b from-black/82 via-black/78 to-black/90 sm:from-black/75 sm:via-black/70 sm:to-black/85"
      />

      <div className="relative mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-32 lg:px-8">
        <Reveal>
          <h1 className="text-shadow-lg text-shadow-black/60 text-3xl leading-[1.15] font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
            <span className="block">Les bonnes compétences.</span>
            <span className="block">Les bonnes personnes.</span>
            <span className="text-brand-accent block">
              Les bonnes opportunités.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-pretty text-white/80 sm:mt-8 sm:text-lg">
            Kinetix t&apos;aide à développer les compétences qui comptent,
            rencontrer les bonnes personnes et transformer ton potentiel en
            projets et opportunités.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:mt-8 sm:flex-row">
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
          <p className="mt-5 flex items-center justify-center gap-2 text-sm text-white/70 sm:mt-6">
            <CheckCircle2 className="text-brand-accent size-4 shrink-0" />
            Formations pratiques. Mentorat réel. Une communauté qui avance.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
