import type { Metadata } from "next";
import { db } from "@/db/client";
import { LEGAL_ENTITY } from "@/config/legal";
import { SITE_NAME } from "@/config/site";
import { getSupportWhatsapp } from "@/repositories/payment-settings";
import { ContactForm } from "@/components/support/contact-form";

const TITLE = `Contact — ${SITE_NAME}`;
const DESCRIPTION = `Une question sur ${SITE_NAME} ? Écris-nous : nous te répondons sur WhatsApp.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/contact" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/contact" },
};

// Static, refreshed when the admin changes the support number (its action
// revalidates this path) and at most every 10 minutes otherwise.
export const revalidate = 600;

export default async function ContactPage() {
  const whatsapp = await getSupportWhatsapp(db);
  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6 sm:py-20">
      <div className="space-y-3">
        <p className="text-brand-accent text-xs font-semibold tracking-widest uppercase">
          Contact
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Une question ? Écris-nous.
        </h1>
        <p className="text-muted-foreground">
          Remplis le formulaire : ton message s&apos;ouvre dans WhatsApp, prêt à
          être envoyé à notre équipe.
        </p>
      </div>
      <div className="border-border bg-card mt-8 rounded-2xl border p-5 shadow-sm sm:p-7">
        <ContactForm whatsapp={whatsapp} email={LEGAL_ENTITY.email} />
      </div>
    </div>
  );
}
