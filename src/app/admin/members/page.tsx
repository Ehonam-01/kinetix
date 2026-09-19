import Link from "next/link";
import { db } from "@/db/client";
import { listMembers } from "@/repositories/admin-members";
import { cn } from "@/lib/utils";

// PENDING_PAYMENT's label was "En attente de paiement" pre-Phase-11 — the
// enum value is unchanged (renaming it is a bigger, separate decision, not
// made here), but its real meaning since the education-first pivot is
// "hasn't joined the ambassador program", not "hasn't paid yet" (see
// MLM_RULES.md) — this member can be a perfectly normal, paying customer.
const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Client (non-ambassadeur)",
  ACTIVE: "Actif",
  SUSPENDED: "Suspendu",
  DELETED: "Supprimé",
};

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
];

function avatarColor(seed: string) {
  const index = seed.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export default async function AdminMembersPage(
  props: PageProps<"/admin/members">,
) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim().toLowerCase() : "";

  const allMembers = await listMembers(db);
  const members = query
    ? allMembers.filter(
        (m) =>
          m.fullName.toLowerCase().includes(query) ||
          (m.email ?? "").toLowerCase().includes(query),
      )
    : allMembers;

  return (
    <div className="space-y-4">
      {query && (
        <p className="text-muted-foreground text-sm">
          {members.length} résultat(s) pour « {q} »
          <Link href="/admin/members" className="text-primary ml-2 underline">
            réinitialiser
          </Link>
        </p>
      )}

      {members.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun membre.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border">
          {/* min-w on the table + overflow-x-auto on this wrapper: on a
              narrow screen the table scrolls sideways instead of squeezing
              4 columns (one holding an avatar + name + email) into
              unreadable widths. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-muted-foreground bg-muted border-b text-left text-xs font-medium tracking-wide uppercase">
                  <th className="px-4 py-3">Membre</th>
                  <th className="px-4 py-3">Niveau</th>
                  <th className="px-4 py-3">Solde</th>
                  <th className="px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/members/${m.id}`}
                        className="flex items-center gap-3"
                      >
                        <div
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                            avatarColor(m.fullName),
                          )}
                        >
                          {m.fullName.trim().charAt(0).toUpperCase() || "?"}
                        </div>
                        <div>
                          <p className="font-medium">{m.fullName}</p>
                          <p className="text-muted-foreground text-xs">
                            {m.email}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {m.currentLevelCode
                        ? `Niveau ${m.currentLevelCode}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {m.availableBalance.toLocaleString("fr-FR")} F
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          m.status === "ACTIVE" &&
                            "bg-green-600/10 text-green-600",
                          m.status === "SUSPENDED" &&
                            "bg-destructive/10 text-destructive",
                          m.status === "PENDING_PAYMENT" &&
                            "bg-muted text-muted-foreground",
                          m.status === "DELETED" &&
                            "bg-muted text-muted-foreground line-through",
                        )}
                      >
                        {STATUS_LABEL[m.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
