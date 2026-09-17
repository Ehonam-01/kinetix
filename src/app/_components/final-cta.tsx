import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { GridBackdrop } from "./grid-backdrop";
import { Reveal } from "./reveal";

export function FinalCta() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <Reveal>
        <div className="from-primary to-primary/70 text-primary-foreground relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-linear-to-br px-6 py-16 text-center sm:px-12">
          <GridBackdrop className="opacity-[0.12]" />
          <div
            aria-hidden="true"
            className="bg-background/10 absolute -top-24 -right-24 size-72 rounded-full blur-3xl"
          />
          <h2 className="relative text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Tu n&apos;as pas besoin d&apos;avoir toutes les réponses pour
            commencer.
          </h2>
          <p className="text-primary-foreground/85 relative mx-auto mt-4 max-w-xl text-lg text-pretty">
            Rejoins une communauté qui t&apos;aide à apprendre, rencontrer,
            construire et avancer — pendant que le monde change.
          </p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="#formations"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-background text-foreground hover:bg-background/90 h-12 px-6 text-base",
              )}
            >
              Explorer les formations
            </a>
            <Link
              href="/register"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 h-12 bg-transparent px-6 text-base",
              )}
            >
              Nous rejoindre
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
