import { getSiteEnv } from "@/config/env.site";
import { db } from "@/db/client";
import { buildWorkshopIcs } from "@/lib/workshop-ics";
import {
  getSession,
  getWorkshop,
  listSessions,
  sessionPlace,
} from "@/repositories/workshops";

// "Ajouter à mon agenda" on the confirmation page, for the participant's
// session (?s=, its city). Public: it only holds what the sales page shows
// anyway.
export async function GET(request: Request) {
  const page = await getWorkshop(db);
  const sessionId = new URL(request.url).searchParams.get("s") ?? "";
  const workshop =
    (/^[0-9a-f-]{36}$/i.test(sessionId)
      ? await getSession(db, page.id, sessionId)
      : null) ??
    (await listSessions(db, page.id))[0] ??
    page;
  const body = buildWorkshopIcs({
    id: workshop.id,
    title: workshop.city
      ? `${workshop.title} (${workshop.city})`
      : workshop.title,
    startsAt: workshop.startsAt,
    endsAt: workshop.endsAt,
    venue: sessionPlace(workshop),
    url: `${getSiteEnv().SITE_URL}/atelier-video-ia`,
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="atelier-video-ia.ics"',
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
