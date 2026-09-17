import Link from "next/link";
import { GridBackdrop } from "@/app/_components/grid-backdrop";
import { Reveal } from "@/app/_components/reveal";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function PaHero() {
  return (
    <section className="relative overflow-hidden">
      <GridBackdrop />
      <div
        aria-hidden="true"
        className="bg-primary/15 absolute top-0 -right-40 size-128 rounded-full blur-3xl"
      />
      <div
        aria-hidden="true"
        className="bg-accent absolute -bottom-24 -left-40 size-112 rounded-full blur-3xl"
      />

      <div className="relative mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-28">
        <Reveal>
          <span className="text-primary bg-primary/10 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
            Programme ambassadeur
          </span>
          <h1 className="font-heading mt-6 text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Recommande ce qui t&apos;a aidé.{" "}
            <span className="text-[#E8712A]">Sois rémunéré</span> pour la valeur
            que tu apportes.
          </h1>
          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-pretty">
            Le programme ambassadeur Kinetix te permet de partager les
            formations que tu apprécies et de recevoir une commission à chaque
            souscription réelle que tu apportes.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-12 w-full px-8 text-base font-semibold tracking-wide uppercase sm:w-auto",
              )}
            >
              Rejoindre Kinetix
            </Link>
            <a
              href="#remuneration"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-12 w-full px-8 text-base sm:w-auto",
              )}
            >
              Voir la rémunération
            </a>
          </div>
          <p className="text-muted-foreground mt-6 text-sm">
            Aucune commission sur les inscriptions. Uniquement sur les
            souscriptions réelles.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
