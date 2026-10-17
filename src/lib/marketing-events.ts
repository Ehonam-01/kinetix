// Browser-side marketing events (Meta pixel). Does nothing unless the pixel
// was loaded — i.e. configured by the admin AND accepted by the visitor
// (components/marketing/marketing-consent.tsx).
type Fbq = (...args: unknown[]) => void;

export const MARKETING_CONSENT_KEY = "kx-consent-marketing";

export function trackMarketingEvent(
  name: "CompleteRegistration" | "InitiateCheckout" | "Purchase" | "Lead",
  params?: Record<string, unknown>,
) {
  if (typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: Fbq }).fbq;
  fbq?.("track", name, params);
}
