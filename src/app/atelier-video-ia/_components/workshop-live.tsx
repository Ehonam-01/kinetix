"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { trackMarketingEvent } from "@/lib/marketing-events";
import { cn } from "@/lib/utils";

const REFRESH_MS = 30_000;

type Live = {
  remaining: number;
  open: boolean;
  price: number;
  whatsappUrl: string | null;
  markClosed: () => void;
};

const LiveContext = createContext<Live | null>(null);

function useLive() {
  const live = useContext(LiveContext);
  if (!live) throw new Error("WorkshopLiveProvider manquant.");
  return live;
}

export function useWorkshopLive() {
  return useLive();
}

// The sales page is cached; the seats aren't. This keeps every counter and
// button on it right, from /api/atelier-video-ia/places, only while the
// page is actually on screen.
export function WorkshopLiveProvider({
  remaining: initialRemaining,
  open: initialOpen,
  price,
  whatsappUrl,
  children,
}: {
  remaining: number;
  open: boolean;
  price: number;
  whatsappUrl: string | null;
  children: ReactNode;
}) {
  const [state, setState] = useState({
    remaining: initialRemaining,
    open: initialOpen,
  });

  useEffect(() => {
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/atelier-video-ia/places");
        if (response.ok) setState(await response.json());
      } catch {
        // No network for a moment: the last figure stays.
      }
    }
    void refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const markClosed = useCallback(
    () => setState((current) => ({ ...current, open: false })),
    [],
  );
  const value = useMemo(
    () => ({ ...state, price, whatsappUrl, markClosed }),
    [state, price, whatsappUrl, markClosed],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function WhatsappButton({
  url,
  label,
  className,
}: {
  url: string;
  label: string;
  className?: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        buttonVariants({ size: "lg" }),
        "h-auto min-h-12 bg-[#128C7E] px-6 py-3 text-center text-base font-semibold whitespace-normal text-white hover:bg-[#128C7E]/90",
        className,
      )}
    >
      <MessageCircle className="size-5" />
      {label}
    </a>
  );
}

// Every "reserve" button, its label followed by the price, leading to the
// form alone on its own page. Once the online sale stops it becomes a WhatsApp link: explicit user decision, a visitor
// past the capacity is never offered a payment.
export function WorkshopCta({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  const { open, price, whatsappUrl } = useLive();

  if (!open && whatsappUrl) {
    return (
      <WhatsappButton
        url={whatsappUrl}
        label="Écrire sur WhatsApp"
        className={className}
      />
    );
  }
  return (
    <Link
      href="/atelier-video-ia/inscription"
      onClick={() =>
        trackMarketingEvent("InitiateCheckout", {
          value: price,
          currency: "XOF",
        })
      }
      className={cn(
        buttonVariants({ size: "lg" }),
        "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90 shadow-brand-accent/30 h-auto min-h-12 px-6 py-3 text-center text-base font-bold whitespace-normal shadow-lg",
        className,
      )}
    >
      {label} – {price.toLocaleString("fr-FR")}&nbsp;F
    </Link>
  );
}

// The line under a button: how to pay, and the seats left (or that the
// online sale is over).
export function CtaNote({ className }: { className?: string }) {
  const { open } = useLive();
  return (
    <p className={cn("text-muted-foreground text-xs", className)}>
      {open ? (
        <>
          Paiement Mobile Money · <SeatsLeft className="text-xs" />
        </>
      ) : (
        <SeatsLeft className="text-xs" />
      )}
    </p>
  );
}

// A card around the button: a question, the date and place, the button
// across the card, the payment line. Its outline is a neon light: a band
// of the accent colour turning behind a 2px gap (kx-neon in globals.css for
// the glow), still for visitors who turned animations off.
export function WorkshopCtaBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-[2px] motion-safe:animate-[kx-neon_2.5s_ease-in-out_infinite]",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 aspect-square w-[200%] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(from_0deg,transparent_0deg,var(--brand-accent)_70deg,transparent_140deg,transparent_180deg,var(--brand-accent)_250deg,transparent_320deg)] motion-safe:animate-[spin_4s_linear_infinite]"
      />
      <div className="bg-card relative rounded-[calc(1rem-2px)] p-5">
        <p className="text-lg font-semibold">
          Prêt à créer ta première publicité avec l&apos;IA ?
        </p>
        <p className="text-muted-foreground mt-2">
          Réserve ta place pour la masterclass du 14 novembre à Lomé.
        </p>
        <WorkshopCta label="JE RÉSERVE MA PLACE" className="mt-4 w-full" />
        <CtaNote className="mt-3 text-center" />
      </div>
    </div>
  );
}

export function SeatsLeft({ className }: { className?: string }) {
  const { remaining, open } = useLive();
  return (
    <span className={cn("text-sm font-semibold", className)} aria-live="polite">
      {open
        ? `${remaining} place${remaining > 1 ? "s" : ""} restante${remaining > 1 ? "s" : ""}`
        : "Inscriptions en ligne terminées"}
    </span>
  );
}

// The button under the hero video: while it is on screen, the bar below
// would only repeat it.
export const HERO_CTA_ID = "reserver";

// Phones only: always in reach on a long page, except where the hero's own
// button is already showing.
export function StickyCta() {
  const [heroCtaVisible, setHeroCtaVisible] = useState(false);

  useEffect(() => {
    const heroCta = document.getElementById(HERO_CTA_ID);
    if (!heroCta) return;
    // Two thirds of it on screen: a sliver of a button isn't one to tap.
    const observer = new IntersectionObserver(
      ([entry]) => setHeroCtaVisible(entry.intersectionRatio >= 0.66),
      { threshold: [0, 0.66, 1] },
    );
    observer.observe(heroCta);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      aria-hidden={heroCtaVisible || undefined}
      inert={heroCtaVisible}
      className={cn(
        "bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t p-3 backdrop-blur transition-transform duration-300 sm:hidden",
        heroCtaVisible && "translate-y-full",
      )}
    >
      <div className="flex items-center gap-3">
        <SeatsLeft className="w-24 shrink-0 text-xs leading-tight" />
        <WorkshopCta label="JE RÉSERVE MA PLACE" className="flex-1 text-sm" />
      </div>
    </div>
  );
}
