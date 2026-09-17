import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Reveal } from "./reveal";

export type ComingSoonCard = {
  icon: LucideIcon;
  title: string;
  description: string;
  // When set, the card links to a real, live feature instead of showing
  // the "Bientôt" badge — lets this shared shell host a mix of shipped and
  // not-yet-shipped cards (e.g. Communauté is live, Mentorat isn't) without
  // ever showing "coming soon" on something that already exists.
  href?: string;
};

// Shared shell for the two "vision" sections that don't have a real
// product behind them yet (Communauté/Mentorat, Projets/Opportunités) —
// explicit user decision: never fake member cards, testimonials or
// activity to sell something that doesn't exist. "Bientôt disponible" is
// the whole honesty budget here: describe the intent, mark it clearly as
// not live, and point back to the one real action (joining) instead of a
// dead end.
export function ComingSoonSection({
  id,
  eyebrow,
  title,
  description,
  cards,
  muted = false,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  cards: ComingSoonCard[];
  muted?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-16 py-16 sm:py-24", muted && "bg-muted/40")}
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-primary text-xs font-semibold tracking-widest uppercase">
              {eyebrow}
            </span>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {title}
            </h2>
            <p className="text-muted-foreground mt-4 text-lg text-pretty">
              {description}
            </p>
          </div>
        </Reveal>

        <Reveal delayMs={100}>
          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
            {cards.map((card) => {
              const content = (
                <>
                  <span
                    className={cn(
                      "absolute top-5 right-5 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase",
                      card.href
                        ? "bg-green-600/10 text-green-600"
                        : "bg-primary/10 text-primary",
                    )}
                  >
                    {card.href ? "Disponible" : "Bientôt"}
                  </span>
                  <div className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
                    <card.icon className="size-5" />
                  </div>
                  <h3 className="font-heading mt-4 font-semibold">
                    {card.title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {card.description}
                  </p>
                </>
              );
              const className =
                "border-border bg-card relative rounded-2xl border p-6 transition-colors" +
                (card.href ? " hover:border-primary/40" : "");
              return card.href ? (
                <Link key={card.title} href={card.href} className={className}>
                  {content}
                </Link>
              ) : (
                <div key={card.title} className={className}>
                  {content}
                </div>
              );
            })}
          </div>
        </Reveal>

        <Reveal delayMs={150}>
          <div className="mt-8 text-center">
            <Link
              href="/register"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Rejoindre Kinetix maintenant
            </Link>
            <p className="text-muted-foreground mt-3 text-xs">
              Rejoins la communauté dès aujourd&apos;hui pour en profiter dès le
              lancement.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
