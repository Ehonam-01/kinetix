import { db } from "@/db/client";
import {
  getWorkshop,
  listSessionsWithAvailability,
} from "@/repositories/workshops";

// Live seats for the sales page, which is itself cached: per city, capacity
// minus registrations really paid. Cached 15 seconds at the edge, so a page
// open on many phones doesn't mean as many database reads.
export async function GET() {
  const page = await getWorkshop(db);
  const sessions = await listSessionsWithAvailability(db, page.id);
  return Response.json(
    {
      sessions: sessions.map(({ session, remaining, open }) => ({
        id: session.id,
        remaining,
        open,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=15, s-maxage=15" } },
  );
}
