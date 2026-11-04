import { db } from "@/db/client";
import { getSiteEnv } from "@/config/env.site";
import { formatWhatsapp, whatsappHref } from "@/lib/whatsapp";
import { getWorkshop, listRegistrations } from "@/repositories/workshops";
import { requireAdmin } from "@/services/auth/current-user";
import { buttonVariants } from "@/components/ui/button";
import {
  AddRegistrationForm,
  BalancePaidButton,
  WorkshopSettingsForm,
} from "./workshop-forms";

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

const fmtDay = (date: Date) =>
  date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Africa/Lome",
  });

// A payment that didn't go through (or a prompt never validated): an admin
// writes to the person to help them pay, from their own WhatsApp.
function retryMessage(fullName: string, startsAt: Date) {
  const firstName = fullName.trim().split(/\s+/)[0];
  return [
    `Bonjour ${firstName}, c'est l'équipe Kinetix Africa.`,
    `Nous avons vu que ton paiement pour la Kinetix AI Video Masterclass du ${fmtDay(startsAt)} n'a pas abouti. Tu as rencontré un souci ? On peut t'aider à finaliser ta réservation.`,
    `Tu peux réessayer ici : ${getSiteEnv().SITE_URL}/atelier-video-ia/inscription`,
    `Tu peux aussi payer en plusieurs fois, dès 1 000 F.`,
  ].join("\n\n");
}

// A seat held with something left to pay: a reminder, with the
// participant's own reservation link (sent to their own number), where
// they pay the rest.
function balanceMessage(
  registration: {
    fullName: string;
    amount: number;
    amountPaid: number;
    accessToken: string;
  },
  startsAt: Date,
) {
  const firstName = registration.fullName.trim().split(/\s+/)[0];
  const fmt = (value: number) => `${value.toLocaleString("fr-FR")} F`;
  return [
    `Bonjour ${firstName}, c'est l'équipe Kinetix Africa.`,
    `Ta place pour la Kinetix AI Video Masterclass du ${fmtDay(startsAt)} est bien réservée. Tu as versé ${fmt(registration.amountPaid)} sur ${fmt(registration.amount)} : il te reste ${fmt(registration.amount - registration.amountPaid)} à payer.`,
    `Tu peux faire ton prochain versement ici : ${getSiteEnv().SITE_URL}/atelier-video-ia/merci?t=${registration.accessToken}`,
    `Tu peux aussi régler le reste sur place le jour J.`,
  ].join("\n\n");
}

// A prompt left this long without an answer won't be validated anymore.
const STALE_PENDING_MS = 30 * 60 * 1000;

// Read per request: this page is rendered for each visit.
function isStale(date: Date) {
  return Date.now() - date.getTime() > STALE_PENDING_MS;
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
  const owing = paid.filter((r) => r.amountPaid < r.amount);
  const owed = owing.reduce((sum, r) => sum + (r.amount - r.amountPaid), 0);
  // Who to write to after a failed payment: once per number (its latest
  // attempt, the list being newest first), and not someone who paid since.
  const paidNumbers = new Set(paid.map((r) => r.whatsapp));
  const toRetry = new Set<string>();
  const seen = new Set<string>();
  for (const r of registrations) {
    if (seen.has(r.whatsapp)) continue;
    seen.add(r.whatsapp);
    const stalled =
      r.status === "FAILED" || (r.status === "PENDING" && isStale(r.createdAt));
    if (stalled && !paidNumbers.has(r.whatsapp)) toRetry.add(r.id);
  }
  // The number opens WhatsApp with what this person needs to hear: help
  // after a failed payment, a reminder of what is left, or nothing.
  const contactMessage = (r: (typeof registrations)[number]) => {
    if (r.status === "PAID" && r.amountPaid < r.amount) {
      return balanceMessage(r, workshop.startsAt);
    }
    if (r.status !== "PAID" && !paidNumbers.has(r.whatsapp)) {
      return retryMessage(r.fullName, workshop.startsAt);
    }
    return undefined;
  };
  const retriedThenPaid = (r: (typeof registrations)[number]) =>
    r.status !== "PAID" && paidNumbers.has(r.whatsapp);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-semibold">Réglages</h2>
        <p className="text-muted-foreground text-sm">
          {paid.length} inscrit(s) payé(s) sur {workshop.capacity} places. À la
          capacité, la page de vente dirige les visiteurs vers WhatsApp.
        </p>
        {owing.length > 0 && (
          <p className="text-sm">
            Dont {owing.length} qui paie(nt) par versements : il reste{" "}
            <strong>{owed.toLocaleString("fr-FR")} F</strong> à encaisser.
          </p>
        )}
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
                    "Versé",
                    "Date",
                    "Code",
                    "Code utilisé",
                    "WhatsApp",
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
                      <a
                        href={whatsappHref(r.whatsapp, contactMessage(r))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {formatWhatsapp(r.whatsapp)}
                      </a>
                    </td>
                    <td className="px-3 py-2">{r.city || "—"}</td>
                    <td className="px-3 py-2">
                      {STATUS_LABEL[r.status]}
                      {r.source === "ADMIN" && " (ajouté)"}
                      {retriedThenPaid(r) && (
                        <span className="text-muted-foreground block text-xs">
                          a payé ensuite
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.status === "PAID" ? (
                        r.amountPaid < r.amount ? (
                          <div className="space-y-1">
                            <p>
                              {r.amountPaid.toLocaleString("fr-FR")} /{" "}
                              {r.amount.toLocaleString("fr-FR")} F
                            </p>
                            <p className="text-destructive text-xs font-medium">
                              Reste{" "}
                              {(r.amount - r.amountPaid).toLocaleString(
                                "fr-FR",
                              )}{" "}
                              F
                            </p>
                            <BalancePaidButton
                              registrationId={r.id}
                              left={r.amount - r.amountPaid}
                            />
                          </div>
                        ) : (
                          `${r.amountPaid.toLocaleString("fr-FR")} F`
                        )
                      ) : (
                        "—"
                      )}
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
                      {toRetry.has(r.id) ? (
                        <a
                          href={whatsappHref(
                            r.whatsapp,
                            retryMessage(r.fullName, workshop.startsAt),
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary font-medium whitespace-nowrap underline-offset-4 hover:underline"
                        >
                          Relancer
                        </a>
                      ) : r.discountCode && !r.discountUsedAt ? (
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
                          Envoyer le code
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
