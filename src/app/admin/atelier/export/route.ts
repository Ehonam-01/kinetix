import { db } from "@/db/client";
import { toCsv } from "@/lib/csv";
import { onePerParticipant } from "@/lib/workshop-participants";
import { getWorkshop, listRegistrations } from "@/repositories/workshops";
import { requireAdmin } from "@/services/auth/current-user";

// The participants list, for the door on the day. A route handler isn't
// covered by admin/layout.tsx: this check is the only gate.
export async function GET() {
  await requireAdmin();
  const workshop = await getWorkshop(db);
  // Each person once, like the admin page.
  const registrations = onePerParticipant(
    await listRegistrations(db, workshop.id),
  );

  const body = toCsv([
    [
      "Nom",
      "WhatsApp",
      "E-mail",
      "Ville",
      "Statut",
      "Montant",
      "Versé",
      "Reste",
      "Date",
      "Code",
      "Code utilisé",
    ],
    ...registrations.map((r) => [
      r.fullName,
      r.whatsapp,
      r.email,
      r.city,
      r.status,
      r.amount,
      r.amountPaid,
      r.status === "PAID" ? Math.max(0, r.amount - r.amountPaid) : "",
      r.createdAt.toISOString(),
      r.discountCode,
      r.discountUsedAt ? "Oui" : "Non",
    ]),
  ]);

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="atelier-inscrits.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
