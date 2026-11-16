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
import { trackMarketingEvent, whenPixelReady } from "@/lib/marketing-events";
import { cn } from "@/lib/utils";
import { citiesLabel, priceSummary, type LiveSession } from "./sessions";

const REFRESH_MS = 30_000;

type Live = {
  sessions: LiveSession[];
  // Seats left across the cities still on sale, and whether any is.
  remaining: number;
  open: boolean;
  // The price on the buttons: the same everywhere, or the lowest ("dès").
  price: number;
  priceFrom: boolean;
  // The value struck through on the buttons: that of the session at the
  // price shown.
  regularPrice: number;
  whatsappUrl: string | null;
  markClosed: (sessionId: string) => void;
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

type Seats = { id: string; remaining: number; open: boolean };

// The sales page is cached; the seats aren't. This keeps every counter and
// button on it right, from /api/atelier-video-ia/places, only while the
// page is actually on screen.
export function WorkshopLiveProvider({
  sessions: initialSessions,
  whatsappUrl,
  children,
}: {
  sessions: LiveSession[];
  whatsappUrl: string | null;
  children: ReactNode;
}) {
  const [sessions, setSessions] = useState(initialSessions);

  useEffect(() => {
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/atelier-video-ia/places");
        if (!response.ok) return;
        const { sessions: seats } = (await response.json()) as {
          sessions: Seats[];
        };
        setSessions((current) =>
          current.map((session) => {
            const live = seats.find((s) => s.id === session.id);
            return live
              ? { ...session, remaining: live.remaining, open: live.open }
              : session;
          }),
        );
      } catch {
        // No network for a moment: the last figure stays.
      }
    }
    void refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const markClosed = useCallback(
    (sessionId: string) =>
      setSessions((current) =>
        current.map((session) =>
          session.id === sessionId ? { ...session, open: false } : session,
        ),
      ),
    [],
  );
  const value = useMemo(() => {
    const onSale = sessions.filter((session) => session.open);
    const { price, from } = priceSummary(onSale.length > 0 ? onSale : sessions);
    const pool = onSale.length > 0 ? onSale : sessions;
    return {
      sessions,
      remaining: onSale.reduce((sum, session) => sum + session.remaining, 0),
      open: onSale.length > 0,
      price,
      priceFrom: from,
      regularPrice:
        pool.find((session) => session.price === price)?.regularPrice ?? 0,
      whatsappUrl,
      markClosed,
    };
  }, [sessions, whatsappUrl, markClosed]);

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function WhatsappButton({
  url,
  label,
  className,
  onClick,
}: {
  url: string;
  label: string;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
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
// form alone on its own page, where InitiateCheckoutTracker counts the
// arrival. Once the online sale stops it becomes a WhatsApp link: explicit
// user decision, a visitor past the capacity is never offered a payment.
export function WorkshopCta({
  label,
  stacked = false,
  className,
}: {
  label: string;
  // The label on one line, the prices on the next: for the narrow bar at
  // the bottom of a phone's screen, where one line overflows.
  stacked?: boolean;
  className?: string;
}) {
  const { open, price, priceFrom, regularPrice, whatsappUrl } = useLive();

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
      className={cn(
        buttonVariants({ size: "lg" }),
        "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90 shadow-brand-accent/30 h-auto min-h-12 px-6 py-3 text-center text-base font-bold whitespace-normal shadow-lg",
        className,
      )}
    >
      {stacked ? (
        <span className="flex flex-col items-center leading-tight">
          <span>{label}</span>
          <span className="mt-0.5 text-xs">
            {regularPrice > price && (
              <s className="mr-1 font-semibold decoration-2 opacity-70">
                {regularPrice.toLocaleString("fr-FR")}&nbsp;F
              </s>
            )}
            {priceFrom ? "dès " : ""}
            {price.toLocaleString("fr-FR")}&nbsp;F
          </span>
        </span>
      ) : (
        <>
          {label} –{" "}
          {regularPrice > price && (
            <s className="mr-1 font-semibold decoration-2 opacity-70">
              {regularPrice.toLocaleString("fr-FR")}&nbsp;F
            </s>
          )}
          {priceFrom ? "dès " : ""}
          {price.toLocaleString("fr-FR")}&nbsp;F
        </>
      )}
    </Link>
  );
}

// The line under a button: how to pay, or that the online sale is over.
// The seats left are only shown per city, on the form (explicit user
// decision): a total across the cities would mislead.
export function CtaNote({ className }: { className?: string }) {
  const { open } = useLive();
  return (
    <p className={cn("text-muted-foreground text-xs", className)}>
      {open ? "Paiement Mobile Money" : <SaleStatus className="text-xs" />}
    </p>
  );
}

// A card around the button: a question, the date and place, the button
// across the card, the payment line. Its outline is a neon light: a band
// of the accent colour turning behind a 2px gap (kx-neon in globals.css for
// the glow), still for visitors who turned animations off.
export function WorkshopCtaBlock({ className }: { className?: string }) {
  const { sessions } = useLive();
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
          Réserve ta place pour la masterclass à {citiesLabel(sessions)}.
        </p>
        <WorkshopCta label="JE RÉSERVE MA PLACE" className="mt-4 w-full" />
        <CtaNote className="mt-3 text-center" />
      </div>
    </div>
  );
}

// The cities still on sale, or that the online sale is over. No seat count:
// those are per city, on the form.
export function SaleStatus({ className }: { className?: string }) {
  const { sessions, open } = useLive();
  return (
    <span className={cn("text-sm font-semibold", className)} aria-live="polite">
      {open
        ? sessions
            .filter((session) => session.open)
            .map((session) => session.city)
            .join(" · ")
        : "Inscriptions en ligne terminées"}
    </span>
  );
}

// A visitor with a question before booking writes to the support number.
// Counted as a Meta "Contact" when the pixel runs.
const trackContact = () => trackMarketingEvent("Contact");

// Under the questions answered on the page (the floating one in the corner
// was removed: explicit user decision, it covered the booking bar).
export function QuestionWhatsappButton({ url }: { url: string }) {
  return (
    <WhatsappButton
      url={url}
      label="Poser ma question sur WhatsApp"
      onClick={trackContact}
    />
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
        <SaleStatus className="w-24 shrink-0 text-xs leading-tight" />
        <WorkshopCta
          label="JE RÉSERVE MA PLACE"
          stacked
          className="flex-1 px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}

// Meta's InitiateCheckout, on reaching the registration form (from the
// sales page or a link straight to it), once per visit of the page.
export function InitiateCheckoutTracker({ value }: { value: number }) {
  useEffect(
    () =>
      whenPixelReady(() =>
        trackMarketingEvent("InitiateCheckout", { value, currency: "XOF" }),
      ),
    [value],
  );
  return null;
}
