// Shown under a payment or withdrawal form: a member whose country isn't
// in the list can reach the support on WhatsApp. Renders nothing until the
// admin sets the number (admin → Paiements).
export function CountrySupportHint({
  whatsapp,
  context,
}: {
  whatsapp: string | null;
  context: "paiement" | "retrait";
}) {
  if (!whatsapp) return null;
  const message =
    context === "paiement"
      ? "Bonjour, mon pays n'est pas dans la liste des paiements Kinetix Africa. Pouvez-vous m'aider à payer mon abonnement ?"
      : "Bonjour, mon pays n'est pas dans la liste des retraits Kinetix Africa. Pouvez-vous m'aider à retirer mes commissions ?";
  const href = `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
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
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 text-sm font-semibold text-white hover:bg-[#1fb857]"
      >
        Contacter sur WhatsApp
      </a>
    </div>
  );
}
