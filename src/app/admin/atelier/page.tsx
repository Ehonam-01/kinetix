import { db } from "@/db/client";
import { getSiteEnv } from "@/config/env.site";
import { formatWhatsapp, whatsappHref } from "@/lib/whatsapp";
import { onePerParticipant } from "@/lib/workshop-participants";
import Link from "next/link";
import {
  getWorkshop,
  listRegistrations,
  listSessionsWithAvailability,
} from "@/repositories/workshops";
import { requireAdmin } from "@/services/auth/current-user";
import { buttonVariants } from "@/components/ui/button";
import {
  AddRegistrationForm,
  BalancePaidButton,
  WorkshopPageForm,
  WorkshopSessionForm,
} from "./workshop-forms";
import { TestimonialsAdmin } from "./testimonials-admin";
import { listTestimonials } from "@/services/workshops/testimonials";

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

const shortDay = (date: Date) =>
  date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Lome",
  });

// "samedi 28 novembre à Kara".
function sessionLabel(session: { startsAt: Date; city: string | null }) {
  return `${fmtDay(session.startsAt)}${session.city ? ` à ${session.city}` : ""}`;
}

// A payment that didn't go through (or a prompt never validated): an admin
// writes to the person to help them pay, from their own WhatsApp.
function retryMessage(fullName: string, session: string) {
  const firstName = fullName.trim().split(/\s+/)[0];
  return [
    `Bonjour ${firstName}, c'est l'équipe Kinetix Africa.`,
    `Nous avons vu que ton paiement pour la Kinetix AI Video Masterclass du ${session} n'a pas abouti. Tu as rencontré un souci ? On peut t'aider à finaliser ta réservation.`,
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
  session: string,
) {
  const firstName = registration.fullName.trim().split(/\s+/)[0];
  const fmt = (value: number) => `${value.toLocaleString("fr-FR")} F`;
  return [
    `Bonjour ${firstName}, c'est l'équipe Kinetix Africa.`,
    `Ta place pour la Kinetix AI Video Masterclass du ${session} est bien réservée. Tu as versé ${fmt(registration.amountPaid)} sur ${fmt(registration.amount)} : il te reste ${fmt(registration.amount - registration.amountPaid)} à payer.`,
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

// The paid workshop (/atelier-video-ia): its sessions (one per city), the
// page's videos, who registered in each session, and the people added by
// hand after writing on WhatsApp.
export default async function AdminWorkshopPage(
  props: PageProps<"/admin/atelier">,
) {
  // Re-checked here, not only in admin/layout.tsx: a layout isn't re-run on
  // every navigation, so it can't be the only gate.
  await requireAdmin();
  const page = await getWorkshop(db);
  const [sessions, testimonials] = await Promise.all([
    listSessionsWithAvailability(db, page.id),
    listTestimonials(db, page.id, { publishedOnly: false }),
  ]);
  // The sessions sold now, then the first one (the page's own row, Lomé,
  // 14 November) with its registrations.
  const choices = [...sessions.map(({ session }) => session), page];
  const { s } = await props.searchParams;
  const selected =
    choices.find((choice) => choice.id === s) ?? choices[0] ?? page;
  const selectedLabel = sessionLabel(selected);
  const registrations = await listRegistrations(db, selected.id);
  const paid = registrations.filter((r) => r.status === "PAID");
  const owing = paid.filter((r) => r.amountPaid < r.amount);
  const owed = owing.reduce((sum, r) => sum + (r.amount - r.amountPaid), 0);
  // The list shows each person once (explicit user decision), however many
  // times they tried: a row still not PAID is someone who never paid.
  const participants = onePerParticipant(registrations);
  type Participant = (typeof participants)[number];
  // Who to write to after a failed payment.
  const stalled = (r: Participant) =>
    r.status === "FAILED" || (r.status === "PENDING" && isStale(r.createdAt));
  // The number opens WhatsApp with what this person needs to hear: help
  // after a failed payment, a reminder of what is left, or nothing.
  const contactMessage = (r: Participant) => {
    if (r.status === "PAID" && r.amountPaid < r.amount) {
      return balanceMessage(r, selectedLabel);
    }
    if (r.status !== "PAID") {
      return retryMessage(r.fullName, selectedLabel);
    }
    return undefined;
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-semibold">Sessions</h2>
        <p className="text-muted-foreground text-sm">
          Une session par ville, avec sa date, son lieu, son prix et ses places.
          Quand une ville est complète, elle ne se vend plus en ligne ; quand
          toutes le sont, la page de vente dirige les visiteurs vers WhatsApp.
        </p>
        {sessions.length === 0 && <p className="text-sm">Aucune session.</p>}
        {sessions.map(({ session, paid: paidCount, open }) => (
          <details
            key={session.id}
            className="rounded-2xl border p-4 [&_summary]:cursor-pointer"
          >
            <summary className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">{sessionLabel(session)}</span>
              <span className="text-muted-foreground text-sm">
                {paidCount} payé(s) sur {session.capacity} places ·{" "}
                {open ? "en vente" : "vente arrêtée"}
              </span>
            </summary>
            <div className="mt-4">
              <WorkshopSessionForm
                session={{
                  ...session,
                  startsAt: session.startsAt.toISOString(),
                  endsAt: session.endsAt.toISOString(),
                }}
              />
            </div>
          </details>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Page de vente</h2>
        <p className="text-muted-foreground text-sm">
          Les vidéos de la page, communes à toutes les villes.
        </p>
        <WorkshopPageForm current={page} />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Témoignages des participants</h2>
        <p className="text-muted-foreground text-sm">
          Affichés sur la page de vente, dans l&apos;ordre ci-dessous : des avis
          écrits et des captures de messages reçus.
        </p>
        <TestimonialsAdmin testimonials={testimonials} />
      </section>

      <section className="space-y-3">
        <nav className="flex flex-wrap gap-2" aria-label="Session affichée">
          {choices.map((choice) => (
            <Link
              key={choice.id}
              href={`/admin/atelier?s=${choice.id}`}
              aria-current={choice.id === selected.id ? "page" : undefined}
              className={buttonVariants({
                variant: choice.id === selected.id ? "default" : "outline",
                size: "sm",
              })}
            >
              {choice.city ?? "Atelier"} · {shortDay(choice.startsAt)}
              {choice.id === page.id && " (1re édition)"}
            </Link>
          ))}
        </nav>
        <p className="text-sm">
          <strong>{selectedLabel}</strong> : {paid.length} inscrit(s) payé(s)
          sur {selected.capacity} places.
          {owing.length > 0 && (
            <>
              {" "}
              Dont {owing.length} qui paie(nt) par versements : il reste{" "}
              <strong>{owed.toLocaleString("fr-FR")} F</strong> à encaisser.
            </>
          )}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">
          Ajouter un participant ({selectedLabel})
        </h2>
        <p className="text-muted-foreground text-sm">
          Pour une personne qui a payé en dehors du site. Elle reçoit un code de
          réduction égal au montant reçu.
        </p>
        <AddRegistrationForm key={selected.id} workshopId={selected.id} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Inscrits ({participants.length})</h2>
          <a
            href={`/admin/atelier/export?s=${selected.id}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Exporter en CSV
          </a>
        </div>
        {participants.length === 0 ? (
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
                {participants.map((r) => (
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
                      {r.attempts > 1 && (
                        <span className="text-muted-foreground block text-xs">
                          {r.attempts} tentatives
                        </span>
                      )}
                      {r.paidCount > 1 && (
                        <span className="text-destructive block text-xs font-medium">
                          Payé {r.paidCount} fois : à rembourser
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
                      {stalled(r) ? (
                        <a
                          href={whatsappHref(
                            r.whatsapp,
                            retryMessage(r.fullName, selectedLabel),
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
                              selected.discountValidUntil,
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
