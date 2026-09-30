import { db } from "@/db/client";
import {
  GRACE_PERIOD_DAYS,
  listMembersInGracePeriod,
  listSubscriptionsForAdmin,
} from "@/repositories/subscriptions";
import { cn } from "@/lib/utils";
import { DeleteTestSubscriptionButton } from "./delete-test-subscription-button";
import {
  GraceReminderAllButton,
  GraceReminderButton,
} from "./grace-reminder-buttons";
import { requireAdmin } from "@/services/auth/current-user";

export default async function AdminSubscriptionsPage() {
  // Re-checked here, not only in admin/layout.tsx: a layout isn't
  // re-run on every navigation, so it can't be the only gate (Next.js
  // authentication guide, "Layouts and auth checks").
  await requireAdmin();
  const [subscriptions, inGrace] = await Promise.all([
    listSubscriptionsForAdmin(db),
    listMembersInGracePeriod(db),
  ]);
  const shortDate = (d: Date) =>
    d.toLocaleDateString("fr-FR", { dateStyle: "medium" });

  return (
    <div className="space-y-4">
      <section
        id="grace"
        className="scroll-mt-6 space-y-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">
              En période de grâce ({inGrace.length})
            </h2>
            <p className="text-muted-foreground text-xs">
              Abonnement expiré depuis moins de {GRACE_PERIOD_DAYS} jours :
              accès et commissions maintenus jusqu&apos;à la date limite, puis
              compte désactivé.
            </p>
          </div>
          {inGrace.length > 1 && (
            <GraceReminderAllButton count={inGrace.length} />
          )}
        </div>
        {inGrace.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucun compte en période de grâce.
          </p>
        ) : (
          <div className="bg-card divide-y rounded-xl border">
            {inGrace.map((m) => (
              <div
                key={m.userId}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {m.fullName}{" "}
                    <span className="text-muted-foreground font-normal">
                      @{m.username}
                    </span>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {m.email ?? "email inconnu"} · expiré le{" "}
                    {shortDate(m.expiresAt)} · dernière relance :{" "}
                    {m.lastReminderAt ? shortDate(m.lastReminderAt) : "aucune"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      m.graceDaysLeft <= 3
                        ? "bg-destructive/10 text-destructive"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                    )}
                  >
                    {m.graceDaysLeft <= 1
                      ? "Dernier jour"
                      : `${m.graceDaysLeft} jours restants`}
                  </span>
                  <GraceReminderButton userId={m.userId} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-muted-foreground text-sm">
        {subscriptions.length} abonnement(s)
      </p>

      {subscriptions.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun abonnement.</p>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((s) => (
            <div
              key={s.id}
              className="space-y-2 rounded-2xl border px-4 py-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{s.buyerUsername}</p>
                  <p className="text-muted-foreground text-xs">
                    {s.ambassadorUsername &&
                      `Attribué à ${s.ambassadorUsername} · `}
                    Du{" "}
                    {s.startedAt.toLocaleDateString("fr-FR", {
                      dateStyle: "medium",
                    })}{" "}
                    au{" "}
                    {s.expiresAt.toLocaleDateString("fr-FR", {
                      dateStyle: "medium",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span>
                    {s.pricePaid.toLocaleString("fr-FR")} F ·{" "}
                    {s.businessVolume.toLocaleString("fr-FR")} pts
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      s.active
                        ? "bg-green-600/10 text-green-600"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {s.active ? "Actif" : "Expiré"}
                  </span>
                </div>
              </div>
              <div className="flex justify-end">
                <DeleteTestSubscriptionButton subscriptionId={s.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
