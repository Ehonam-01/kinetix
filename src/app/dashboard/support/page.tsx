import { db } from "@/db/client";
import { LEGAL_ENTITY } from "@/config/legal";
import { getSupportWhatsapp } from "@/repositories/payment-settings";
import { requireUser } from "@/services/auth/current-user";
import { ContactForm } from "@/components/support/contact-form";

// The same contact form as the public /contact page, with the member's
// name and pseudo already filled in.
export default async function SupportPage() {
  const { profile } = await requireUser();
  const whatsapp = await getSupportWhatsapp(db);
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Support</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Une question, un souci ? Ton message s&apos;ouvre dans WhatsApp, prêt
          à être envoyé à l&apos;équipe Kinetix Africa.
        </p>
      </div>
      <div className="border-border bg-card rounded-2xl border p-5 sm:p-6">
        <ContactForm
          whatsapp={whatsapp}
          email={LEGAL_ENTITY.email}
          defaultName={profile.fullName}
          defaultUsername={profile.username}
        />
      </div>
    </div>
  );
}
