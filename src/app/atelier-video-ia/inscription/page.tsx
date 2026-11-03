import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/db/client";
import { whatsappHref } from "@/lib/whatsapp";
import { getSupportWhatsapp } from "@/repositories/payment-settings";
import { getWorkshop, getWorkshopAvailability } from "@/repositories/workshops";
import { WHATSAPP_REGISTER_TEXT } from "../_components/content";
import { PaymentLogos } from "../_components/payment-logos";
import { RegistrationForm } from "../_components/registration-form";
import {
  InitiateCheckoutTracker,
  WorkshopLiveProvider,
} from "../_components/workshop-live";

// The search result to show is the sales page, not its form.
export const metadata: Metadata = {
  title: "Réserve ta place — Kinetix AI Video Masterclass",
  robots: { index: false, follow: true },
};

// Same as the sales page: the seats stay live in the browser.
export const revalidate = 60;

// The form alone: visitors who aren't used to websites were getting lost
// looking for it in the long sales page. A page of its own rather than a
// layer on top, so that a phone's back button returns to the presentation
// instead of leaving the site.
export default async function AtelierInscriptionPage() {
  const [workshop, supportWhatsapp] = await Promise.all([
    getWorkshop(db),
    getSupportWhatsapp(db),
  ]);
  const { remaining, open } = await getWorkshopAvailability(db, workshop);

  return (
    <WorkshopLiveProvider
      remaining={remaining}
      open={open}
      price={workshop.priceCfa}
      whatsappUrl={
        supportWhatsapp
          ? whatsappHref(supportWhatsapp, WHATSAPP_REGISTER_TEXT)
          : null
      }
    >
      <InitiateCheckoutTracker value={workshop.priceCfa} />
      <main className="mx-auto max-w-md px-4 py-6 sm:py-10">
        <Link
          href="/atelier-video-ia"
          className="text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 text-sm font-medium"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Retour à la présentation
        </Link>

        <div className="mt-3 text-center">
          <h1 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
            Réserve ta place
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Kinetix AI Video Masterclass
            <br />
            Samedi 14 novembre · 8 h – 13 h · Lomé
          </p>
        </div>

        <div className="mt-6">
          <RegistrationForm />
        </div>

        <PaymentLogos className="mt-6 lg:justify-center" />
        <p className="text-muted-foreground mt-4 text-center text-sm">
          Après ton paiement, ta place est réservée et tu reçois les
          informations pratiques ainsi que le lien du groupe WhatsApp des
          participants.
        </p>
      </main>
    </WorkshopLiveProvider>
  );
}
