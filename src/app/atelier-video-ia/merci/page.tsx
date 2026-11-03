import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, CheckCircle2, Share2, XCircle } from "lucide-react";
import { getSiteEnv } from "@/config/env.site";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/db/client";
import { cn } from "@/lib/utils";
import {
  findLatestRegistrationPayment,
  findRegistrationByToken,
  getWorkshop,
} from "@/repositories/workshops";
import { TO_BRING } from "../_components/content";
import { RichText } from "../_components/rich-text";
import { WhatsappButton } from "../_components/workshop-live";
import { InstallmentForm } from "./installment-form";
import { PurchaseTracker, StatusWatcher } from "./status-watcher";

// The token in the link is the participant's only proof of identity: this
// page stays out of search engines, and out of referrers.
export const metadata: Metadata = {
  title: "Ta réservation — Kinetix AI Video Masterclass",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const fmtDate = (date: Date) =>
  date.toLocaleDateString("fr-FR", {
    dateStyle: "full",
    timeZone: "Africa/Lome",
  });
const fmtTime = (date: Date) =>
  date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lome",
  });

// Read per request: this page is rendered for each visit (its token).
function hasEnded(date: Date) {
  return Date.now() >= date.getTime();
}

function isRecent(date: Date, minutes: number) {
  return Date.now() - date.getTime() < minutes * 60 * 1000;
}

const fmtCfa = (value: number) => `${value.toLocaleString("fr-FR")} F`;

// The number as typed on this page: without the Togo code.
function localPhone(whatsapp: string) {
  return whatsapp.startsWith("228") ? whatsapp.slice(3) : `+${whatsapp}`;
}

export default async function AtelierMerciPage(
  props: PageProps<"/atelier-video-ia/merci">,
) {
  const { t } = await props.searchParams;
  if (typeof t !== "string") notFound();
  const registration = await findRegistrationByToken(db, t);
  if (!registration) notFound();
  const workshop = await getWorkshop(db);
  // The code is given after the workshop and the platform's presentation:
  // until it ends, this page doesn't show it (the admins can also send it
  // by WhatsApp from /admin/atelier).
  const codeRevealed = hasEnded(workshop.endsAt);
  // Payment in parts: what is left, and the part being paid right now, if
  // any (one that didn't go through leaves the seat as it was).
  const latest = await findLatestRegistrationPayment(db, registration.id);
  const left = Math.max(0, registration.amount - registration.amountPaid);
  const isLaterPart = !!latest && latest.id !== registration.paymentId;
  const partPending =
    isLaterPart &&
    latest.status === "PENDING" &&
    isRecent(latest.createdAt, 15);
  const partFailed =
    isLaterPart &&
    (latest.status === "FAILED" || latest.status === "CANCELLED") &&
    isRecent(latest.createdAt, 30);
  const started = hasEnded(workshop.startsAt);
  const reservationUrl = `${getSiteEnv().SITE_URL}/atelier-video-ia/merci?t=${t}`;

  return (
    <>
      <main className="mx-auto max-w-xl space-y-6 px-4 py-10 text-center sm:px-6 sm:py-16 sm:text-left">
        {registration.status === "PENDING" && (
          <div className="bg-card space-y-3 rounded-2xl border p-5">
            <h1 className="text-2xl font-semibold">
              Valide le paiement sur ton téléphone
            </h1>
            <p>
              Une demande de paiement de{" "}
              {fmtCfa(latest?.amount ?? registration.amount)} vient d&apos;être
              envoyée. Ta place sera confirmée dès que le paiement sera validé.
            </p>
            <StatusWatcher token={t} />
          </div>
        )}

        {registration.status === "FAILED" && (
          <div className="bg-card space-y-3 rounded-2xl border p-5">
            <XCircle className="text-destructive mx-auto size-8 sm:mx-0" />
            <h1 className="text-2xl font-semibold">
              Le paiement n&apos;a pas abouti
            </h1>
            <p>Aucune place n&apos;a été réservée. Tu peux réessayer.</p>
            <Link
              href="/atelier-video-ia/inscription"
              className={buttonVariants({ size: "lg" })}
            >
              Réessayer
            </Link>
          </div>
        )}

        {registration.status === "PAID" && (
          <>
            <PurchaseTracker
              registrationId={registration.id}
              value={registration.amount}
            />
            <div className="space-y-2">
              <CheckCircle2 className="mx-auto size-8 text-green-600 sm:mx-0" />
              <h1 className="text-2xl font-semibold">
                {left > 0
                  ? "Ta place est réservée !"
                  : "Ta place est confirmée !"}
              </h1>
              <p className="text-muted-foreground">{workshop.title}</p>
            </div>

            {partPending && (
              <div className="bg-card space-y-3 rounded-2xl border p-5">
                <h2 className="font-semibold">
                  Valide le versement de {fmtCfa(latest.amount)} sur ton
                  téléphone
                </h2>
                <StatusWatcher token={t} />
              </div>
            )}

            {partFailed && (
              <p
                className="border-destructive/40 bg-destructive/5 rounded-2xl border p-4 text-sm"
                role="alert"
              >
                Ton dernier versement de {fmtCfa(latest.amount)} n&apos;a pas
                abouti. Ta place reste réservée : tu peux réessayer ci-dessous.
              </p>
            )}

            {left > 0 && (
              <div className="bg-card space-y-4 rounded-2xl border p-5">
                <div>
                  <h2 className="font-semibold">Ton paiement</h2>
                  <p className="mt-1 text-sm">
                    Tu as versé{" "}
                    <strong>{fmtCfa(registration.amountPaid)}</strong> sur{" "}
                    {fmtCfa(registration.amount)}. Il te reste{" "}
                    <strong>{fmtCfa(left)}</strong> à payer.
                  </p>
                  <div
                    className="bg-muted mt-3 h-2.5 overflow-hidden rounded-full"
                    role="progressbar"
                    aria-label="Montant déjà versé"
                    aria-valuemin={0}
                    aria-valuemax={registration.amount}
                    aria-valuenow={registration.amountPaid}
                  >
                    <div
                      className="bg-brand-accent h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (registration.amountPaid / registration.amount) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {started ? (
                  <p className="text-sm">
                    La masterclass a commencé : le reste se paie sur place.
                  </p>
                ) : (
                  <>
                    <p className="text-muted-foreground text-sm">
                      Verse ce que tu veux, quand tu veux, jusqu&apos;au jour de
                      la masterclass. Tu peux aussi payer le reste sur place le
                      jour même.
                    </p>
                    {!partPending && (
                      <InstallmentForm
                        token={t}
                        left={left}
                        defaultPhone={localPhone(registration.whatsapp)}
                      />
                    )}
                    <div className="border-t pt-4 text-sm">
                      <p className="font-medium">Garde le lien de cette page</p>
                      <p className="text-muted-foreground mt-1">
                        C&apos;est ici que tu reviens pour tes prochains
                        versements. Envoie-le-toi sur WhatsApp pour le retrouver
                        facilement.
                      </p>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Ma réservation Kinetix AI Video Masterclass (pour mes versements) : ${reservationUrl}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          buttonVariants({ variant: "outline", size: "lg" }),
                          "mt-3 h-11 w-full",
                        )}
                      >
                        <Share2 className="size-4" />
                        M&apos;envoyer ce lien sur WhatsApp
                      </a>
                    </div>
                  </>
                )}
              </div>
            )}

            <dl className="bg-card grid gap-2 rounded-2xl border p-5 text-sm">
              <div>
                <dt className="text-muted-foreground">Date</dt>
                <dd className="font-medium">{fmtDate(workshop.startsAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Heure</dt>
                <dd className="font-medium">
                  {fmtTime(workshop.startsAt)} – {fmtTime(workshop.endsAt)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Lieu</dt>
                <dd className="font-medium">{workshop.venue}</dd>
              </div>
            </dl>

            <div className="flex flex-col gap-3">
              {workshop.whatsappGroupUrl ? (
                <WhatsappButton
                  url={workshop.whatsappGroupUrl}
                  label="Rejoindre le groupe WhatsApp des participants"
                />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Le lien du groupe WhatsApp des participants arrive bientôt sur
                  cette page.
                </p>
              )}
              <a
                href="/atelier-video-ia/agenda.ics"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "h-12",
                )}
              >
                <CalendarPlus className="size-5" />
                Ajouter à mon agenda
              </a>
            </div>

            <div className="bg-card rounded-2xl border p-5">
              <h2 className="font-semibold">Ce que tu dois apporter</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {TO_BRING.map((item) => (
                  <li key={item}>
                    <RichText text={item} />
                  </li>
                ))}
              </ul>
            </div>

            {registration.discountCode && codeRevealed && (
              <div className="border-brand-accent bg-brand-accent/10 rounded-2xl border-2 p-5">
                <h2 className="font-semibold">Ton code de réduction</h2>
                <p className="mt-2 font-mono text-xl font-bold break-all">
                  {registration.discountCode}
                </p>
                <p className="mt-2 text-sm">
                  {registration.amount.toLocaleString("fr-FR")} F déduits de ton
                  abonnement Kinetix Africa si tu le saisis lors du paiement par
                  Mobile Money. Utilisable une seule fois, jusqu&apos;au{" "}
                  {fmtDate(workshop.discountValidUntil)} à{" "}
                  {fmtTime(workshop.discountValidUntil)}.
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
