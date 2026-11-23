"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const HERO_CTA_ID = "course-hero-cta";

// Phones only: the main button always within reach on a long page, except
// while the hero's own button is on screen (same rule as the workshop
// page's bar).
export function StickyBuyBar({
  href,
  label,
  price,
  note,
}: {
  href: string;
  label: string;
  price: string;
  note: string;
}) {
  const [heroCtaVisible, setHeroCtaVisible] = useState(true);

  useEffect(() => {
    const heroCta = document.getElementById(HERO_CTA_ID);
    if (!heroCta) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeroCtaVisible(entry.intersectionRatio > 0),
      { threshold: [0, 1] },
    );
    observer.observe(heroCta);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      aria-hidden={heroCtaVisible || undefined}
      inert={heroCtaVisible}
      className={cn(
        "bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur transition-transform duration-300 sm:hidden [html[data-consent-banner=open]_&]:hidden",
        heroCtaVisible && "translate-y-full",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 shrink-0 leading-tight">
          <p className="font-bold tabular-nums">{price}</p>
          <p className="text-muted-foreground text-xs">{note}</p>
        </div>
        <Link
          href={href}
          className={cn(
            buttonVariants({ size: "lg" }),
            "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90 h-11 flex-1",
          )}
        >
          {label}
        </Link>
      </div>
    </div>
  );
}
