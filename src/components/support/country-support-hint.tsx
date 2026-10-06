import { ExternalLink, ShoppingBag } from "lucide-react";

// Shown under a payment or withdrawal form, for a member whose country or
// means of payment isn't offered: the support on WhatsApp and, for a
// payment, the admin's outside payment page (e.g. a Maketou shop) — paid
// there, the account is activated by an admin once the member sends their
// proof on WhatsApp. Renders nothing until the admin sets either one
// (admin → Paiements).
export function CountrySupportHint({
  whatsapp,
  context,
  alternativePaymentUrl = null,
}: {
  whatsapp: string | null;
  context: "paiement" | "retrait";
  alternativePaymentUrl?: string | null;
}) {
  const shopUrl = context === "paiement" ? alternativePaymentUrl : null;
  if (!whatsapp && !shopUrl) return null;

  const message =
    context === "paiement"
      ? shopUrl
        ? "Bonjour, j'ai payé mon abonnement Kinetix Africa sur la boutique en ligne. Voici ma preuve de paiement. Mon pseudo : "
        : "Bonjour, mon pays n'est pas dans la liste des paiements Kinetix Africa. Pouvez-vous m'aider à payer mon abonnement ?"
      : "Bonjour, mon pays n'est pas dans la liste des retraits Kinetix Africa. Pouvez-vous m'aider à retirer mes commissions ?";
  const whatsappHref = whatsapp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`
    : null;
  const whatsappButton = whatsappHref && (
    <a
      href={whatsappHref}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 text-sm font-semibold text-white hover:bg-[#1fb857]"
    >
      {shopUrl ? "Envoyer ma preuve sur WhatsApp" : "Contacter sur WhatsApp"}
    </a>
  );

  if (shopUrl) {
    return (
      <div className="border-brand-accent/50 bg-brand-accent/10 space-y-3 rounded-xl border-2 p-4 text-sm shadow-sm">
        <p className="flex items-center gap-2 text-base font-semibold">
          <span className="bg-brand-accent text-brand-accent-foreground flex size-8 shrink-0 items-center justify-center rounded-full">
            <ShoppingBag className="size-4" />
          </span>
          Ton moyen de paiement n&apos;est pas proposé ?
        </p>
        <p>
          <span className="text-muted-foreground">
            Paie ton abonnement sur notre boutique en ligne
            {whatsapp ? (
              <>
                , puis envoie ta preuve de paiement et ton pseudo au support sur
                WhatsApp au{" "}
                <span className="text-foreground font-medium whitespace-nowrap select-all">
                  +{whatsapp}
                </span>
              </>
            ) : null}
            . Ton compte est activé dès la vérification de ton paiement.
          </span>
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href={shopUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-brand-accent text-brand-accent-foreground hover:bg-brand-accent/90 inline-flex min-h-11 items-center sm:flex-1 justify-center gap-2 rounded-lg px-4 text-sm font-bold shadow-sm transition-colors"
          >
            Payer sur la boutique en ligne
            <ExternalLink className="size-3.5" />
          </a>
          {whatsappButton}
        </div>
      </div>
    );
  }

  return (
    <div className="border-border bg-muted/40 flex flex-col gap-3 rounded-xl border p-4 text-sm sm:flex-row sm:items-center">
      <p className="min-w-0 flex-1">
        <span className="font-medium">
          Votre pays n&apos;est pas dans la liste ?
        </span>{" "}
        <span className="text-muted-foreground">
          Écrivez au support sur WhatsApp au{" "}
          <span className="text-foreground font-medium whitespace-nowrap select-all">
            +{whatsapp}
          </span>
          , on vous aide à trouver une solution.
        </span>
      </p>
      {whatsappButton}
    </div>
  );
}
