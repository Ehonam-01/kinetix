"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, Sparkles, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { LaunchCountdown } from "@/components/launch-countdown";
import { formatPrice } from "@/lib/format-price";
import {
  CONSENT_BANNER_EVENT,
  consentBannerOpen,
} from "@/lib/marketing-events";
import { splitTranches } from "@/lib/split-payment";
import { cn } from "@/lib/utils";

// The launch-offer invitation on the homepage: opens once the visitor has
// had a moment on the page (OPEN_AFTER_MS, or half the page scrolled,
// whichever comes first), never over the cookie banner (it waits for an
// answer), and once closed not again for a week in that browser
// (SNOOZE_MS, remembered in localStorage — best effort: without storage it
// simply shows once per visit). Only rendered while there is a launch offer
// (services/pricing/launch-offer.ts), with the same figures as the pricing
// section: never a price or a date the page doesn't otherwise state.
const STORAGE_KEY = "kx-launch-popup-dismissed-at";
const OPEN_AFTER_MS = 20_000;
const OPEN_AFTER_SCROLL = 0.5;
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(at) && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // Storage unavailable: it shows again on the next visit, that's all.
  }
}

const fmt = formatPrice;

export function LaunchOfferPopup({
  price,
  nextPrice,
  endsAt,
  lastDayLabel,
}: {
  price: number;
  nextPrice: number;
  endsAt: string | null;
  lastDayLabel: string | null;
}) {
  const [open, setOpen] = useState(false);
  // Paying in 3 times (lib/split-payment.ts), as on the pricing section.
  const tranches = splitTranches(price);
  const ctaRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (dismissedRecently()) return;
    let due = false;
    let done = false;
    // Due, but the cookie banner still waits for an answer: once it has one.
    const show = () => {
      due = true;
      if (done || consentBannerOpen()) return;
      done = true;
      setOpen(true);
    };
    const onBanner = () => {
      if (due) show();
    };
    const timer = window.setTimeout(show, OPEN_AFTER_MS);
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= OPEN_AFTER_SCROLL) show();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener(CONSENT_BANNER_EVENT, onBanner);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener(CONSENT_BANNER_EVENT, onBanner);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    ctaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    rememberDismissal();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="launch-offer-title"
        className="bg-card text-card-foreground animate-in fade-in slide-in-from-bottom-4 relative w-full max-w-md overflow-hidden rounded-3xl border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Fermer"
          className="absolute top-2 right-2 z-10 flex size-11 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/15 hover:text-white"
        >
          <X className="size-5" />
        </button>

        <div className="from-primary to-primary/80 relative overflow-hidden bg-linear-to-br px-6 pt-7 pb-6 text-center text-white">
          <div
            aria-hidden="true"
            className="bg-brand-accent/40 absolute -top-12 -right-12 size-40 rounded-full blur-3xl"
          />
          <span className="bg-brand-accent text-brand-accent-foreground relative inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold">
            <Sparkles className="size-3.5" />
            Offre de lancement
          </span>
          <h2
            id="launch-offer-title"
            className="relative mt-3 text-2xl font-bold text-balance"
          >
            Rejoins Kinetix au prix de lancement
          </h2>
          <div className="relative mt-4 flex items-baseline justify-center gap-3">
            <span className="text-lg font-semibold text-white/60 tabular-nums line-through">
              {fmt(nextPrice)}
            </span>
            <span className="text-4xl font-bold tracking-tight tabular-nums">
              {fmt(price)}
            </span>
            <span className="text-sm text-white/80">/ an</span>
          </div>
          <p className="relative mt-2 text-sm text-white/85">
            Tu économises{" "}
            <strong className="text-brand-accent">
              {fmt(nextPrice - price)}
            </strong>{" "}
            en t&apos;inscrivant maintenant.
          </p>
          {tranches && (
            <p className="relative mt-3 rounded-xl bg-white/10 px-3 py-2 text-sm">
              Ou en 3 fois :{" "}
              <strong>{fmt(tranches[0])} aujourd&apos;hui</strong>, puis{" "}
              {tranches[1] === tranches[2]
                ? `2 × ${fmt(tranches[1])}`
                : `${fmt(tranches[1])} et ${fmt(tranches[2])}`}
              .
            </p>
          )}
        </div>

        <div className="space-y-4 px-6 pt-5 pb-6">
          {endsAt && lastDayLabel ? (
            <div className="space-y-2 text-center">
              <p className="flex items-center justify-center gap-1.5 text-sm font-medium">
                <Clock className="text-brand-accent size-4" />
                Jusqu&apos;au {lastDayLabel}
              </p>
              <LaunchCountdown
                endsAt={endsAt}
                boxClassName="bg-muted"
                labelClassName="text-muted-foreground"
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-center text-sm">
              Le tarif passera bientôt à {fmt(nextPrice)} / an.
            </p>
          )}
          <a
            ref={ctaRef}
            href="/register"
            onClick={rememberDismissal}
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90 h-12 w-full text-base",
            )}
          >
            J&apos;en profite
          </a>
          <button
            type="button"
            onClick={close}
            className="text-muted-foreground hover:text-foreground w-full text-sm"
          >
            Plus tard
          </button>
          <p className="text-muted-foreground text-center text-xs">
            Abonnement annuel, sans renouvellement automatique.
          </p>
        </div>
      </div>
    </div>
  );
}
