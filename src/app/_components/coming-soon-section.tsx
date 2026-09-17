import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { MediaSlot } from "./media-slot";
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
  // Reserves real photo space above the card (MediaSlot — placeholder
  // until the file exists in /public, see media-slot.tsx). Optional: a
  // card with no image keeps the icon-only layout.
  image?: { src: string; alt: string; brief: string };
};

// Shared shell for the two "vision" sections that don't have a real
// product behind them yet (Communauté/Mentorat, Projets/Opportunités) —
// explicit user decision: never fake member cards, testimonials or
// activity to sell something that doesn't exist. "Bientôt disponible" is
// the whole honesty budget here: describe the intent, mark it clearly as
// not live, and point back to the one real action (joining) instead of a
// dead end.
//
// Cards are large and few (max 2 today) on purpose — a tight 2-up grid
// with generous padding and big type reads as an editorial statement, not
// a feature-comparison table.
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
      className={cn("scroll-mt-16 py-20 sm:py-28", muted && "bg-muted/40")}
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-brand-accent text-xs font-semibold tracking-widest uppercase">
              {eyebrow}
            </span>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              {title}
            </h2>
            <p className="text-muted-foreground mt-5 text-xl leading-relaxed text-pretty">
              {description}
            </p>
          </div>
        </Reveal>

        <Reveal delayMs={100}>
          <div className="mx-auto mt-14 grid max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2">
            {cards.map((card) => {
              const content = (
                <>
                  {card.image && (
                    <MediaSlot
                      src={card.image.src}
                      alt={card.image.alt}
                      brief={card.image.brief}
                      className="-m-8 mb-6 aspect-video rounded-t-3xl rounded-b-none"
                    />
                  )}
                  <span
                    className={cn(
                      "absolute top-6 right-6 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase",
                      card.image && "backdrop-blur-sm",
                      card.href
                        ? card.image
                          ? "bg-green-600/90 text-white"
                          : "bg-green-600/10 text-green-600"
                        : card.image
                          ? "bg-black/50 text-white"
                          : "bg-muted-foreground/10 text-muted-foreground",
                    )}
                  >
                    {card.href ? "Disponible" : "Bientôt"}
                  </span>
                  <div className="bg-brand-accent/10 text-brand-accent flex size-12 items-center justify-center rounded-2xl">
                    <card.icon className="size-6" />
                  </div>
                  <h3 className="font-heading mt-5 text-xl font-semibold">
                    {card.title}
                  </h3>
                  <p className="text-muted-foreground mt-3 text-base leading-relaxed">
                    {card.description}
                  </p>
                </>
              );
              const className =
                "border-border bg-card relative overflow-hidden rounded-3xl border p-8 transition-colors" +
                (card.href ? " hover:border-brand-accent/40" : "");
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
          <div className="mt-10 text-center">
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
