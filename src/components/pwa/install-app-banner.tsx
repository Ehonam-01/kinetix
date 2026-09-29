"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// Chrome/Edge/Samsung Internet's install event (not in TypeScript's DOM lib).
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    // Set by PWA_INSTALL_CAPTURE_SCRIPT (app/layout.tsx) — the event can
    // fire before this component has even mounted.
    __kinetixInstallPrompt?: InstallPromptEvent;
  }
}

// Captures the install event as early as possible, before React loads.
// Only deferred (preventDefault, so we show our own button instead of the
// browser's mini-bar) on /dashboard, where InstallAppBanner lives —
// elsewhere the browser keeps its default behavior.
export const PWA_INSTALL_CAPTURE_SCRIPT = `window.addEventListener("beforeinstallprompt",function(e){if(location.pathname.indexOf("/dashboard")===0)e.preventDefault();window.__kinetixInstallPrompt=e;window.dispatchEvent(new Event("kinetix-installable"))});`;

const DISMISS_KEY = "kinetix-install-dismissed-at";
const DISMISS_DAYS = 30;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's own flag for a home-screen launch.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

// "Installer l'application" card at the top of the member area. Android and
// desktop Chrome get a real install button; iPhone/iPad (no install API in
// Safari) get the two taps to do it by hand. Hidden once installed, when
// opened from the installed app, or for 30 days after "Plus tard".
export function InstallAppBanner() {
  const [mode, setMode] = useState<"prompt" | "ios" | null>(null);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const sync = () => {
      if (window.__kinetixInstallPrompt) setMode("prompt");
    };
    const installed = () => setMode(null);

    // Deferred to a microtask: this effect only syncs with the browser's
    // state, it doesn't render anything synchronously itself.
    queueMicrotask(() => {
      if (window.__kinetixInstallPrompt) setMode("prompt");
      else if (isIos()) setMode("ios");
    });
    window.addEventListener("kinetix-installable", sync);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("kinetix-installable", sync);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (!mode) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Storage blocked (private browsing) — just hide it for this visit.
    }
    setMode(null);
  }

  async function install() {
    const event = window.__kinetixInstallPrompt;
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice;
    // The event can only be used once.
    window.__kinetixInstallPrompt = undefined;
    if (outcome === "accepted") setMode(null);
  }

  return (
    <div className="border-primary/20 bg-primary/5 mb-6 flex items-start gap-3 rounded-2xl border p-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon from /public, next/image adds nothing here */}
      <img
        src="/icons/icon-192.png"
        alt=""
        className="size-11 shrink-0 rounded-xl border bg-white"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          Installez l&apos;application Kinetix Africa
        </p>
        {mode === "prompt" ? (
          <>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Retrouvez vos formations en un geste, depuis l&apos;écran
              d&apos;accueil de votre téléphone.
            </p>
            <Button size="sm" className="mt-3" onClick={install}>
              <Download className="size-4" />
              Installer
            </Button>
          </>
        ) : (
          <p className="text-muted-foreground mt-0.5 text-sm">
            Dans Safari, touchez{" "}
            <Share
              className="inline size-4 align-text-bottom"
              aria-label="Partager"
            />{" "}
            puis <strong>« Sur l&apos;écran d&apos;accueil »</strong>.
          </p>
        )}
      </div>
      <Button
        size="icon-xs"
        variant="ghost"
        onClick={dismiss}
        aria-label="Plus tard"
        title="Plus tard"
      >
        <X />
      </Button>
    </div>
  );
}
