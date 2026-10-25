"use client";

import { useEffect } from "react";

const UTM_KEYS = [
  ["utm_source", "utmSource"],
  ["utm_medium", "utmMedium"],
  ["utm_campaign", "utmCampaign"],
  ["utm_content", "utmContent"],
  ["utm_term", "utmTerm"],
] as const;

// Records where the visitor came from when a page is opened from a
// campaign link (utm_* in the address) or from another site
// (services/marketing/campaign-tracking.ts). Once per arrival: the same
// address reloaded in this tab isn't counted again. Sends no personal data
// — only the campaign parameters, the page and the referring site.
export function CampaignTracker() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasUtm = UTM_KEYS.some(([key]) => params.get(key));
    let externalReferrer = false;
    try {
      externalReferrer =
        !!document.referrer &&
        new URL(document.referrer).host !== window.location.host;
    } catch {
      externalReferrer = false;
    }
    if (!hasUtm && !externalReferrer) return;

    const seenKey = `kx-visit:${window.location.pathname}${window.location.search}`;
    try {
      if (sessionStorage.getItem(seenKey)) return;
      sessionStorage.setItem(seenKey, "1");
    } catch {
      // No storage: counted once per page load, that's fine.
    }

    const body: Record<string, string> = {
      landingPath: window.location.pathname,
      referrer: document.referrer,
    };
    for (const [key, field] of UTM_KEYS) {
      const value = params.get(key);
      if (value) body[field] = value;
    }
    fetch("/api/marketing/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  }, []);

  return null;
}
