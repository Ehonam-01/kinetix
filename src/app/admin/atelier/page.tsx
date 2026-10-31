import { db } from "@/db/client";
import { getSiteEnv } from "@/config/env.site";
import { formatWhatsapp, whatsappHref } from "@/lib/whatsapp";
import { getWorkshop, listRegistrations } from "@/repositories/workshops";
import { requireAdmin } from "@/services/auth/current-user";
import { buttonVariants } from "@/components/ui/button";
import { AddRegistrationForm, WorkshopSettingsForm } from "./workshop-forms";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  PAID: "Payé",
  FAILED: "Échoué",
};

const fmtDate = (date: Date) =>
  date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

const fmtValidUntil = (date: Date) =>
  date.toLocaleString("fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Lome",
  });

// The participant's code, sent by an admin after the workshop and the
// platform's presentation: the confirmation page only shows it once the
// workshop is over.
function codeMessage(
  registration: { fullName: string; amount: number; discountCode: string },
  validUntil: Date,
) {
  const firstName = registration.fullName.trim().split(/\s+/)[0];
  return [
    `Bonjour ${firstName}, merci d'avoir participé à la Kinetix AI Video Masterclass !`,
    `Voici ton code de réduction : ${registration.discountCode}`,
    `${registration.amount.toLocaleString("fr-FR")} F déduits de ton abonnement Kinetix Africa si tu le saisis lors du paiement par Mobile Money. Utilisable une seule fois, jusqu'au ${fmtValidUntil(validUntil)}.`,
    `Crée ton compte : ${getSiteEnv().SITE_URL}/register`,
  ].join("\n\n");
}

// The paid workshop (/atelier-video-ia): its settings, who registered, and
// the people added by hand after writing on WhatsApp.
export default async function AdminWorkshopPage() {
  // Re-checked here, not only in admin/layout.tsx: a layout isn't re-run on
  // every navigation, so it can't be the only gate.
  await requireAdmin();
  const workshop = await getWorkshop(db);
  const registrations = await listRegistrations(db, workshop.id);
  const paid = registrations.filter((r) => r.status === "PAID");

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-semibold">Réglages</h2>
        <p className="text-muted-foreground text-sm">
          {paid.length} inscrit(s) payé(s) sur {workshop.capacity} places. À la
          capacité, la page de vente dirige les visiteurs vers WhatsApp.
        </p>
        <WorkshopSettingsForm current={workshop} />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Ajouter un participant</h2>
        <p className="text-muted-foreground text-sm">
          Pour une personne qui a payé en dehors du site. Elle reçoit un code de
          réduction égal au montant reçu.
        </p>
        <AddRegistrationForm />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Inscrits ({registrations.length})</h2>
          <a
            href="/admin/atelier/export"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Exporter en CSV
          </a>
        </div>
        {registrations.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucune inscription.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {[
                    "Nom",
                    "WhatsApp",
                    "Ville",
                    "Statut",
                    "Date",
                    "Code",
                    "Code utilisé",
                    "Envoyer le code",
                  ].map((label) => (
                    <th key={label} className="px-3 py-2 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {registrations.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">{r.fullName}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatWhatsapp(r.whatsapp)}
                    </td>
                    <td className="px-3 py-2">{r.city}</td>
                    <td className="px-3 py-2">
                      {STATUS_LABEL[r.status]}
                      {r.source === "ADMIN" && " (ajouté)"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {fmtDate(r.createdAt)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.discountCode ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.discountUsedAt ? "Oui" : "Non"}
                    </td>
                    <td className="px-3 py-2">
                      {r.discountCode && !r.discountUsedAt ? (
                        <a
                          href={whatsappHref(
                            r.whatsapp,
                            codeMessage(
                              { ...r, discountCode: r.discountCode },
                              workshop.discountValidUntil,
                            ),
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary font-medium whitespace-nowrap underline-offset-4 hover:underline"
                        >
                          WhatsApp
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
