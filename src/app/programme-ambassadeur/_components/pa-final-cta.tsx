import Link from "next/link";
import { GridBackdrop } from "@/app/_components/grid-backdrop";
import { Reveal } from "@/app/_components/reveal";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function PaFinalCta() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <Reveal>
        <div className="from-primary to-primary/70 text-primary-foreground relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-linear-to-br px-6 py-16 text-center sm:px-12">
          <GridBackdrop className="opacity-[0.12]" />
          <div
            aria-hidden="true"
            className="bg-background/10 absolute -top-24 -right-24 size-72 rounded-full blur-3xl"
          />
          <p className="relative text-lg leading-relaxed text-balance sm:text-xl">
            Tu recommandes déjà Kinetix à ton entourage ?
            <br />
            Autant être rémunéré pour la valeur que tu apportes.
          </p>
          <h2 className="font-heading relative mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Deviens ambassadeur Kinetix.
          </h2>
          <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className={cn(
                buttonVariants({ size: "lg" }),
                "bg-background text-foreground hover:bg-background/90 h-12 w-full px-8 text-base font-semibold tracking-wide uppercase sm:w-auto",
              )}
            >
              Je rejoins Kinetix
            </Link>
          </div>
          <p className="text-primary-foreground/80 relative mt-5 text-sm">
            Commissions sur souscriptions réelles. Aucune obligation de
            recrutement.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
