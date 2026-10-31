import { getSiteEnv } from "@/config/env.site";
import { db } from "@/db/client";
import { buildWorkshopIcs } from "@/lib/workshop-ics";
import { getWorkshop } from "@/repositories/workshops";

// "Ajouter à mon agenda" on the confirmation page. Public: it only holds
// what the workshop's sales page shows anyway.
export async function GET() {
  const workshop = await getWorkshop(db);
  const body = buildWorkshopIcs({
    id: workshop.id,
    title: workshop.title,
    startsAt: workshop.startsAt,
    endsAt: workshop.endsAt,
    venue: workshop.venue,
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
