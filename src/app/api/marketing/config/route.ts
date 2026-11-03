import { getMetaPixelId } from "@/services/marketing/campaign-tracking";

// Where the law asks for a visitor's agreement before an advertising pixel
// runs: the EU, the rest of the EEA, the UK and Switzerland. Explicit user
// decision: the ads only target Togo and the site only ever Africa, so
// everywhere else the pixel runs from the start, with a notice and a way
// to refuse it.
const CONSENT_FIRST_COUNTRIES = new Set(
  (
    "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE " +
    "IS LI NO GB CH"
  ).split(" "),
);

// The Meta pixel id set in Admin → Marketing, for the browser
// (components/marketing/marketing-consent.tsx) — public by nature, it ends
// up in the page anyway — and whether this visitor must accept it first,
// from the country Vercel reads off their connection (none locally: no
// prior agreement there). Per visitor, so kept by their browser only, 5
// minutes: a change in the admin reaches visitors within that time.
export async function GET(request: Request) {
  const metaPixelId = await getMetaPixelId();
  const country = request.headers.get("x-vercel-ip-country")?.toUpperCase();
  const consentRequired = !!country && CONSENT_FIRST_COUNTRIES.has(country);
  return Response.json(
    { metaPixelId, consentRequired },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
