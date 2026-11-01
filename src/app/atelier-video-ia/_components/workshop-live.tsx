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

// Every "reserve" button, its label followed by the price. Once the online
// sale stops it becomes a WhatsApp link: explicit user decision, a visitor
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
    <a
      href="#inscription"
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
    </a>
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
// across the card, the payment line.
export function WorkshopCtaBlock({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card rounded-2xl border p-5", className)}>
      <p className="text-lg font-semibold">
        Prêt à créer ta première publicité avec l&apos;IA ?
      </p>
      <p className="text-muted-foreground mt-2">
        Réserve ta place pour la masterclass du 14 novembre à Lomé.
      </p>
      <WorkshopCta label="JE RÉSERVE MA PLACE" className="mt-4 w-full" />
      <CtaNote className="mt-3 text-center" />
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

// Phones only: always in reach on a long page.
export function StickyCta() {
  return (
    <div className="bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t p-3 backdrop-blur sm:hidden">
      <div className="flex items-center gap-3">
        <SeatsLeft className="w-24 shrink-0 text-xs leading-tight" />
        <WorkshopCta label="JE RÉSERVE MA PLACE" className="flex-1 text-sm" />
      </div>
    </div>
  );
}
