import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { supportCategoryLabel } from "@/config/support";
import { requireUser } from "@/services/auth/current-user";
import { openTicketForMember } from "@/services/support/support-tickets";
import { TicketReplyForm } from "@/components/support/ticket-reply-form";
import { TicketStatusBadge } from "@/components/support/ticket-status-badge";
import { TicketThread } from "@/components/support/ticket-thread";
import { isUuid } from "@/lib/utils";
import { replyToTicketAction } from "../actions";
import { CloseTicketButton } from "./close-ticket-button";

export default async function MemberTicketPage(
  props: PageProps<"/dashboard/support/[ticketId]">,
) {
  const { profile } = await requireUser();
  const { ticketId } = await props.params;
  if (!isUuid(ticketId)) notFound();
  const result = await openTicketForMember(profile.id, ticketId);
  if (!result) notFound();
  const { ticket, messages } = result;

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/dashboard/support"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        Mes tickets
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">
            Ticket #{ticket.number} · {supportCategoryLabel(ticket.category)}
          </p>
          <h1 className="mt-1 text-xl font-semibold break-words sm:text-2xl">
            {ticket.subject}
          </h1>
        </div>
        <TicketStatusBadge status={ticket.status} />
      </div>

      <div className="border-border bg-card rounded-2xl border p-4 sm:p-6">
        <TicketThread messages={messages} memberLabel="Toi" />
      </div>

      <div className="border-border bg-card space-y-3 rounded-2xl border p-4 sm:p-6">
        {ticket.status === "CLOSED" && (
          <p className="text-muted-foreground text-sm">
            Ce ticket est fermé. Écris un message pour le rouvrir si ton
            problème n&apos;est pas réglé.
          </p>
        )}
        <TicketReplyForm
          onReply={replyToTicketAction.bind(null, ticket.id)}
          placeholder="Ta réponse…"
          submitLabel={
            ticket.status === "CLOSED" ? "Rouvrir et envoyer" : "Envoyer"
          }
        />
        {ticket.status === "ANSWERED" && (
          <div className="border-t pt-3">
            <CloseTicketButton ticketId={ticket.id} />
          </div>
        )}
      </div>
    </div>
  );
}
