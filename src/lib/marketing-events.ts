// Browser-side marketing events (Meta pixel). Does nothing unless the pixel
// was loaded — i.e. configured by the admin and not refused by the visitor
// (components/marketing/marketing-consent.tsx).
type Fbq = (...args: unknown[]) => void;

export const MARKETING_CONSENT_KEY = "kx-consent-marketing";

export function trackMarketingEvent(
  name:
    | "CompleteRegistration"
    | "InitiateCheckout"
    | "Purchase"
    | "Lead"
    | "Contact",
  params?: Record<string, unknown>,
  // eventID: Meta counts two events with the same name and id once.
  options?: { eventID: string },
) {
  if (typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  if (options) fbq?.("track", name, params, options);
  else fbq?.("track", name, params);
}

// The pixel loads a moment after the page (the root layout fetches its
// settings first): runs onReady once it's there, checking every second for
// a while, and gives up quietly if it never comes (refused, or none set).
// Returns the cleanup for a useEffect.
export function whenPixelReady(onReady: () => void, tries = 15) {
  let left = tries;
  const interval = setInterval(() => {
    left -= 1;
    const loaded = typeof window !== "undefined" && "fbq" in window;
    if (loaded) onReady();
    if (loaded || left <= 0) clearInterval(interval);
  }, 1000);
  return () => clearInterval(interval);
}
