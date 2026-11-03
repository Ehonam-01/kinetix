"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MARKETING_CONSENT_KEY } from "@/lib/marketing-events";

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: unknown;
  loaded: boolean;
  version: string;
};

function readConsent(): "granted" | "denied" | null {
  try {
    const value = localStorage.getItem(MARKETING_CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

function saveConsent(value: "granted" | "denied") {
  try {
    localStorage.setItem(MARKETING_CONSENT_KEY, value);
  } catch {
    // No storage: asked again on the next visit.
  }
}

// Meta's standard base code, without the inline script: the queue stub
// first, then the library from connect.facebook.net.
function loadMetaPixel(pixelId: string) {
  const w = window as unknown as { fbq?: Fbq; _fbq?: Fbq };
  if (w.fbq) return;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.queue = [];
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  w.fbq = fbq;
  w._fbq = fbq;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  fbq("init", pixelId);
}

// The Meta (Facebook) pixel, set in Admin → Marketing. Where the law asks
// for it (consentRequired, from api/marketing/config), it only loads once
// the visitor accepts it, and nothing goes to Meta before. Everywhere else
// it runs from the start, and the banner is a notice with a way to refuse:
// a refusal stops it at once (Meta's own "revoke") and on later visits.
// Either choice is remembered. With no pixel configured, there's nothing
// to ask and nothing shown.
export function MarketingConsent() {
  const pathname = usePathname();
  const [pixelId, setPixelId] = useState<string | null>(null);
  const [consentRequired, setConsentRequired] = useState(true);
  const [consent, setConsent] = useState<"granted" | "denied" | null>(null);
  const [ready, setReady] = useState(false);
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/marketing/config")
      .then((r) => (r.ok ? r.json() : { metaPixelId: null }))
      .then(
        (config: { metaPixelId: string | null; consentRequired?: boolean }) => {
          if (cancelled) return;
          setPixelId(config.metaPixelId);
          // Missing (an older cached answer): the careful way.
          setConsentRequired(config.consentRequired !== false);
          setConsent(readConsent());
          setReady(true);
        },
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const active =
    !!pixelId &&
    (consent === "granted" || (!consentRequired && consent === null));

  // A page view per page, while it runs.
  useEffect(() => {
    if (!active || !pixelId) return;
    loadMetaPixel(pixelId);
    if (lastTracked.current === pathname) return;
    lastTracked.current = pathname;
    (window as unknown as { fbq: Fbq }).fbq("track", "PageView");
  }, [active, pixelId, pathname]);

  // Refused after it started: Meta stops sending anything from this page.
  useEffect(() => {
    if (consent !== "denied") return;
    const w = window as unknown as { fbq?: Fbq };
    w.fbq?.("consent", "revoke");
  }, [consent]);

  if (!ready || !pixelId || consent !== null) return null;

  function choose(value: "granted" | "denied") {
    saveConsent(value);
    setConsent(value);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookies de mesure publicitaire"
      className="bg-card text-card-foreground fixed inset-x-3 bottom-3 z-40 mx-auto max-w-xl rounded-2xl border p-4 shadow-2xl sm:bottom-5"
    >
      <p className="text-sm leading-relaxed">
        Nous utilisons le pixel de Meta (Facebook) pour mesurer
        l&apos;efficacité de nos publicités.{" "}
        {consentRequired
          ? "Il n'est activé que si tu l'acceptes."
          : "Tu peux le refuser."}{" "}
        <Link
          href="/confidentialite"
          className="text-primary underline underline-offset-4"
        >
          En savoir plus
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => choose("denied")}>
          Refuser
        </Button>
        <Button size="sm" onClick={() => choose("granted")}>
          {consentRequired ? "Accepter" : "J'ai compris"}
        </Button>
      </div>
    </div>
  );
}
