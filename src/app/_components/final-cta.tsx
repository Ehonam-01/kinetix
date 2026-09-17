import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "./reveal";

// Bookends the homepage with the same real photo the hero opens on
// (public/hero2.png is the only authentic photo asset in the project —
// see hero-section.tsx) rather than reusing it mid-page or inventing a
// second image; a dark scrim keeps the white/amber text readable, same
// treatment as the hero.
export function FinalCta() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <Reveal>
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl px-6 py-20 text-center sm:px-12 sm:py-28">
          <Image
            src="/hero2.png"
            alt=""
            fill
            className="object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-linear-to-b from-black/80 via-black/70 to-black/85"
          />
          <h2 className="relative text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl">
            Tu n&apos;as pas besoin d&apos;avoir toutes les réponses pour
            commencer.
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-pretty text-white/85">
            Rejoins une communauté qui t&apos;aide à apprendre, rencontrer,
            construire et avancer — pendant que le monde change.
          </p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90 h-12 px-6 text-base",
              )}
            >
              Rejoindre Kinetix
            </Link>
            <a
              href="#formations"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 border-white/30 bg-white/5 px-6 text-base text-white hover:bg-white/10",
              )}
            >
              Explorer les formations
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
