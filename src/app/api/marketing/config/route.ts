import { getMetaPixelId } from "@/services/marketing/campaign-tracking";

// The Meta pixel id set in Admin → Marketing, for the browser
// (components/marketing/marketing-consent.tsx) — public by nature, it ends
// up in the page anyway. Cached 5 minutes: a change in the admin reaches
// visitors within that time.
export async function GET() {
  const metaPixelId = await getMetaPixelId();
  return Response.json(
    { metaPixelId },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    },
  );
}
