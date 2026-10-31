import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, CheckCircle2, XCircle } from "lucide-react";
import { Footer } from "@/app/_components/footer";
import { Navbar } from "@/app/_components/navbar";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/db/client";
import { cn } from "@/lib/utils";
import {
  findRegistrationByToken,
  getWorkshop,
} from "@/repositories/workshops";
import { TO_BRING } from "../_components/content";
import { RichText } from "../_components/rich-text";
import { WhatsappButton } from "../_components/workshop-live";
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

export default async function AtelierMerciPage(
  props: PageProps<"/atelier-video-ia/merci">,
) {
  const { t } = await props.searchParams;
  if (typeof t !== "string") notFound();
  const registration = await findRegistrationByToken(db, t);
  if (!registration) notFound();
  const workshop = await getWorkshop(db);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-xl space-y-6 px-4 py-10 sm:px-6 sm:py-16">
        {registration.status === "PENDING" && (
          <div className="bg-card space-y-3 rounded-2xl border p-5">
            <h1 className="text-2xl font-semibold">
              Valide le paiement sur ton téléphone
            </h1>
            <p>
              Une demande de paiement de{" "}
              {registration.amount.toLocaleString("fr-FR")} F vient d&apos;être
              envoyée. Ta place sera confirmée dès que le paiement sera validé.
            </p>
            <StatusWatcher token={t} />
          </div>
        )}

        {registration.status === "FAILED" && (
          <div className="bg-card space-y-3 rounded-2xl border p-5">
            <XCircle className="text-destructive size-8" />
            <h1 className="text-2xl font-semibold">Le paiement n&apos;a pas abouti</h1>
            <p>Aucune place n&apos;a été réservée. Tu peux réessayer.</p>
            <Link
              href="/atelier-video-ia#inscription"
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
              <CheckCircle2 className="size-8 text-green-600" />
              <h1 className="text-2xl font-semibold">Ta place est confirmée !</h1>
              <p className="text-muted-foreground">{workshop.title}</p>
            </div>

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

            {registration.discountCode && (
              <div className="border-brand-accent bg-brand-accent/10 rounded-2xl border-2 p-5">
                <h2 className="font-semibold">Ton code de réduction</h2>
                <p className="mt-2 font-mono text-xl font-bold break-all">
                  {registration.discountCode}
                </p>
                <p className="mt-2 text-sm">
                  {registration.amount.toLocaleString("fr-FR")} F déduits de ton
                  abonnement Kinetix Africa si tu le saisis lors du paiement
                  par Mobile Money. Utilisable une seule fois, jusqu&apos;au{" "}
                  {fmtDate(workshop.discountValidUntil)} à{" "}
                  {fmtTime(workshop.discountValidUntil)}.
                </p>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
