import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { GridBackdrop } from "./grid-backdrop";
import { ProductMockup } from "./product-mockup";
import { Reveal } from "./reveal";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <GridBackdrop />
      <span
        aria-hidden="true"
        className="bg-primary/60 absolute top-24 left-[15%] size-1.5 rounded-full"
      />
      <span
        aria-hidden="true"
        className="bg-primary/40 absolute top-40 right-[12%] size-1 rounded-full"
      />
      <div
        aria-hidden="true"
        className="bg-primary/15 absolute top-0 -right-40 size-128 rounded-full blur-3xl"
      />
      <div
        aria-hidden="true"
        className="bg-accent absolute -bottom-24 -left-40 size-112 rounded-full blur-3xl"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:px-8 lg:py-24">
        <Reveal>
          <div className="max-w-xl">
            <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Le repère de celles et ceux qui se préparent à l&apos;avenir.
            </h1>
            <p className="text-muted-foreground mt-6 text-lg leading-relaxed text-pretty">
              L&apos;intelligence artificielle rebat déjà les cartes du monde du
              travail. Kinetix Africa est l&apos;endroit où la jeunesse
              développe des compétences concrètes, trouve des mentors et rejoint
              une communauté qui avance — pour ne jamais subir le changement,
              mais s&apos;y préparer.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#formations"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-12 px-6 text-base",
                )}
              >
                Découvrir les formations
              </a>
              <a
                href="#comment-ca-marche"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-12 px-6 text-base",
                )}
              >
                Comment ça marche ?
              </a>
            </div>
            <p className="text-muted-foreground mt-6 flex items-center gap-2 text-sm">
              <CheckCircle2 className="text-primary size-4 shrink-0" />
              Formations pratiques. Mentorat réel. Une communauté qui avance.
            </p>
          </div>
        </Reveal>

        <Reveal delayMs={150}>
          <ProductMockup />
        </Reveal>
      </div>
    </section>
  );
}
