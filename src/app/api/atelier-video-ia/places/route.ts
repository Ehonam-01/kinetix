import { db } from "@/db/client";
import { getWorkshop, getWorkshopAvailability } from "@/repositories/workshops";

// Live seats for the sales page, which is itself cached: capacity minus
// registrations really paid. Cached 15 seconds at the edge, so a page open
// on many phones doesn't mean as many database reads.
export async function GET() {
  const workshop = await getWorkshop(db);
  const { remaining, open } = await getWorkshopAvailability(db, workshop);
  return Response.json(
    { remaining, open },
    { headers: { "Cache-Control": "public, max-age=15, s-maxage=15" } },
  );
}
