import Link from "next/link";
import { ChevronRight, MessageCircle, Plus } from "lucide-react";
import { db } from "@/db/client";
import { LEGAL_ENTITY } from "@/config/legal";
import { supportCategoryLabel } from "@/config/support";
import { getSupportWhatsapp } from "@/repositories/payment-settings";
import { requireUser } from "@/services/auth/current-user";
import { listTicketsForMember } from "@/services/support/support-tickets";
import { buttonVariants } from "@/components/ui/button";
import { ContactForm } from "@/components/support/contact-form";
import { TicketStatusBadge } from "@/components/support/ticket-status-badge";
import { cn } from "@/lib/utils";

const fmtDate = (date: Date) =>
  date.toLocaleDateString("fr-FR", { dateStyle: "medium" });

// Support tickets first: the member writes, the team answers here (and by
// email). The WhatsApp contact form stays below for urgent questions.
export default async function SupportPage() {
  const { profile } = await requireUser();
  const [tickets, whatsapp] = await Promise.all([
    listTicketsForMember(profile.id),
    getSupportWhatsapp(db),
  ]);

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Support</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Ouvre un ticket : l&apos;équipe Kinetix Africa te répond ici, et tu
            reçois un email à chaque réponse.
          </p>
        </div>
        <Link
          href="/dashboard/support/new"
          className={cn(buttonVariants(), "shrink-0")}
        >
          <Plus className="size-4" />
          Nouveau ticket
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Mes tickets</h2>
        {tickets.length === 0 ? (
          <p className="text-muted-foreground border-border rounded-2xl border border-dashed px-4 py-8 text-center text-sm">
            Tu n&apos;as encore ouvert aucun ticket.
          </p>
        ) : (
          <ul className="border-border bg-card divide-y rounded-2xl border">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/dashboard/support/${ticket.id}`}
                  className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium">
                      {ticket.hasNewReply && (
                        <span
                          className="bg-brand-accent size-2 shrink-0 rounded-full"
                          aria-label="Nouvelle réponse"
                        />
                      )}
                      <span className="truncate">{ticket.subject}</span>
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      #{ticket.number} · {supportCategoryLabel(ticket.category)}{" "}
                      · {fmtDate(ticket.lastMessageAt)}
                    </p>
                  </div>
                  <TicketStatusBadge status={ticket.status} />
                  <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="border-border bg-card group rounded-2xl border">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-sm font-medium">
          <MessageCircle className="size-4 text-[#25D366]" />
          Besoin d&apos;une réponse rapide ? Écris-nous sur WhatsApp
          <ChevronRight className="text-muted-foreground ml-auto size-4 transition-transform group-open:rotate-90" />
        </summary>
        <div className="border-t px-5 py-5">
          <ContactForm
            whatsapp={whatsapp}
            email={LEGAL_ENTITY.email}
            defaultName={profile.fullName}
            defaultUsername={profile.username}
          />
        </div>
      </details>
    </div>
  );
}
