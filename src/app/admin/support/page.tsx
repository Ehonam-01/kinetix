import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { supportCategoryLabel } from "@/config/support";
import { requireAdmin } from "@/services/auth/current-user";
import {
  countTicketsByStatus,
  listTicketsForAdmin,
  type SupportTicketStatus,
} from "@/services/support/support-tickets";
import { cn } from "@/lib/utils";

const TABS: { status: SupportTicketStatus; label: string }[] = [
  { status: "OPEN", label: "À traiter" },
  { status: "ANSWERED", label: "En attente du membre" },
  { status: "CLOSED", label: "Fermés" },
];

const fmtDateTime = (date: Date) =>
  date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });

// Members' support tickets (dashboard/support). "À traiter": the member
// wrote last and is waiting, oldest first.
export default async function AdminSupportPage(
  props: PageProps<"/admin/support">,
) {
  // Re-checked here, not only in admin/layout.tsx: a layout isn't re-run on
  // every navigation, so it can't be the only gate.
  await requireAdmin();
  const { statut } = await props.searchParams;
  const status =
    TABS.find((t) => t.status === statut)?.status ?? ("OPEN" as const);
  const [tickets, counts] = await Promise.all([
    listTicketsForAdmin(status),
    countTicketsByStatus(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.status}
            href={`/admin/support?statut=${tab.status}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              tab.status === status
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-muted",
            )}
          >
            {tab.label} ({counts[tab.status]})
          </Link>
        ))}
      </div>

      {tickets.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {status === "OPEN"
            ? "Aucun ticket en attente de réponse."
            : "Aucun ticket ici."}
        </p>
      ) : (
        <ul className="divide-y rounded-2xl border">
          {tickets.map(({ ticket, fullName, username }) => (
            <li key={ticket.id}>
              <Link
                href={`/admin/support/${ticket.id}`}
                className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3 text-sm transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    #{ticket.number} · {ticket.subject}
                  </p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {fullName} ({username}) ·{" "}
                    {supportCategoryLabel(ticket.category)} · dernier message le{" "}
                    {fmtDateTime(ticket.lastMessageAt)}
                  </p>
                </div>
                <ChevronRight className="text-muted-foreground size-4 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
