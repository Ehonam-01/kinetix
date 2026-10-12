import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { supportCategoryLabel } from "@/config/support";
import { formatWhatsapp, whatsappHref } from "@/lib/whatsapp";
import { isUuid } from "@/lib/utils";
import { requireAdmin } from "@/services/auth/current-user";
import { getTicketForAdmin } from "@/services/support/support-tickets";
import { TicketReplyForm } from "@/components/support/ticket-reply-form";
import { TicketStatusBadge } from "@/components/support/ticket-status-badge";
import { TicketThread } from "@/components/support/ticket-thread";
import { replyAsStaffAction } from "../actions";
import { TicketStatusButton } from "./status-button";

const ADMIN_STATUS_LABEL = {
  OPEN: "À traiter",
  ANSWERED: "En attente du membre",
  CLOSED: "Fermé",
} as const;

export default async function AdminTicketPage(
  props: PageProps<"/admin/support/[ticketId]">,
) {
  await requireAdmin();
  const { ticketId } = await props.params;
  if (!isUuid(ticketId)) notFound();
  const result = await getTicketForAdmin(ticketId);
  if (!result) notFound();
  const { ticket, messages, fullName, username, phone, country } = result;

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/admin/support"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        Tous les tickets
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">
            Ticket #{ticket.number} · {supportCategoryLabel(ticket.category)}
          </p>
          <h1 className="mt-1 text-xl font-semibold break-words">
            {ticket.subject}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {fullName} ({username}){country ? ` · ${country}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <TicketStatusBadge
            status={ticket.status}
            labels={ADMIN_STATUS_LABEL}
          />
          {phone && (
            <a
              href={whatsappHref(
                phone,
                `Bonjour ${fullName}, c'est l'équipe Kinetix Africa au sujet de ton ticket #${ticket.number}.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1fb857]"
            >
              <MessageCircle className="size-3.5" />
              {formatWhatsapp(phone)}
            </a>
          )}
        </div>
      </div>

      <div className="rounded-2xl border p-4 sm:p-6">
        <TicketThread
          messages={messages}
          memberLabel={fullName}
          staffLabel="Équipe Kinetix (vous)"
        />
      </div>

      <div className="space-y-3 rounded-2xl border p-4 sm:p-6">
        <TicketReplyForm
          onReply={replyAsStaffAction.bind(null, ticket.id, false)}
          placeholder="Votre réponse au membre (il la reçoit aussi par email)…"
          submitLabel="Répondre"
          secondary={{
            label: "Répondre et fermer",
            onReply: replyAsStaffAction.bind(null, ticket.id, true),
          }}
        />
        <div className="border-t pt-3">
          {ticket.status === "CLOSED" ? (
            <TicketStatusButton
              ticketId={ticket.id}
              status="OPEN"
              label="Rouvrir le ticket"
            />
          ) : (
            <TicketStatusButton
              ticketId={ticket.id}
              status="CLOSED"
              label="Fermer sans répondre"
            />
          )}
        </div>
      </div>
    </div>
  );
}
