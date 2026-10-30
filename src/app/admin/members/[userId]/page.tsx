import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { findAuthEmailByUserId } from "@/repositories/auth-users";
import {
  getBalance,
  listTransactions,
} from "@/repositories/financial-transactions";
import { listLevelProgress } from "@/repositories/member-levels";
import { listMemberRewards } from "@/repositories/member-rewards";
import { getNetworkView } from "@/repositories/network";
import { findProfileById } from "@/repositories/profiles";
import { getSubscriptionStatus } from "@/repositories/subscriptions";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DeleteAccountButton } from "./delete-account-button";
import { GrantSubscriptionButton } from "./grant-subscription-button";
import { ValidateSubscriptionForm } from "./validate-subscription-form";
import { SubscriptionReminder } from "./subscription-reminder";
import {
  getLastSubscriptionReminder,
  reminderKindFor,
  subscriptionReminderText,
} from "@/services/admin/send-subscription-reminder";
import { getLaunchOffer } from "@/services/pricing/launch-offer";
import { getSubscriptionCreditPreview } from "@/services/subscriptions/grant-subscription-credit";
import { whatsappHref } from "@/lib/whatsapp";
import { StatusActionButton } from "./status-action-button";
import { requireAdmin } from "@/services/auth/current-user";

// See admin/members/page.tsx's comment — same relabel, same reason.
const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Client (non-ambassadeur)",
  ACTIVE: "Actif",
  SUSPENDED: "Suspendu",
  DELETED: "Supprimé",
};

const REWARD_STATUS_LABEL: Record<string, string> = {
  ELIGIBLE: "À réclamer",
  CLAIMED: "Réclamée",
  PROCESSING: "En cours de livraison",
  DELIVERED: "Livrée",
};

export default async function AdminMemberDetailPage(
  props: PageProps<"/admin/members/[userId]">,
) {
  // Re-checked here, not only in admin/layout.tsx: a layout isn't
  // re-run on every navigation, so it can't be the only gate (Next.js
  // authentication guide, "Layouts and auth checks").
  await requireAdmin();
  const { userId } = await props.params;
  const member = await findProfileById(userId);
  if (!member) notFound();

  const [
    email,
    balance,
    levelProgress,
    rewards,
    transactions,
    network,
    subscription,
  ] = await Promise.all([
    findAuthEmailByUserId(db, userId),
    getBalance(db, userId),
    listLevelProgress(db, userId),
    listMemberRewards(db, userId),
    listTransactions(db, userId, 10),
    getNetworkView(db, userId, 2),
    getSubscriptionStatus(db, userId),
  ]);

  const creditPreview = subscription.active
    ? null
    : await getSubscriptionCreditPreview(userId);

  // "Relancer": only for a member who can still pay by themselves.
  const reminderKind = await reminderKindFor(userId);
  const reminder =
    reminderKind && member.status !== "DELETED"
      ? await (async () => {
          const [last, offer] = await Promise.all([
            getLastSubscriptionReminder(userId),
            getLaunchOffer(db),
          ]);
          const firstName = member.fullName.trim().split(/\s+/)[0] ?? "";
          return {
            lastLabel: last
              ? last.toLocaleString("fr-FR", {
                  dateStyle: "long",
                  timeStyle: "short",
                })
              : null,
            whatsappUrl: member.phone
              ? whatsappHref(
                  member.phone,
                  subscriptionReminderText(firstName, reminderKind, offer).join(
                    "\n\n",
                  ),
                )
              : null,
          };
        })()
      : null;

  const currentLevel = levelProgress
    .filter((l) => l.status !== "LOCKED")
    .at(-1);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{member.fullName}</h1>
          <p className="text-muted-foreground text-sm">{email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(member.status === "ACTIVE" ||
            member.status === "PENDING_PAYMENT") && (
            <StatusActionButton
              userId={member.id}
              target="SUSPENDED"
              label="Suspendre"
            />
          )}
          {member.status === "SUSPENDED" && (
            <StatusActionButton
              userId={member.id}
              target="ACTIVE"
              label="Réactiver"
            />
          )}
          {member.status !== "DELETED" && (
            <Link
              href={`/admin/recharge?username=${encodeURIComponent(member.username)}`}
              className={buttonVariants({ variant: "outline" })}
            >
              Recharger ce membre
            </Link>
          )}
          {member.status !== "DELETED" && (
            <DeleteAccountButton userId={member.id} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card size="sm">
          <CardContent className="space-y-1">
            <CardDescription>Statut</CardDescription>
            <CardTitle className="text-lg">
              {STATUS_LABEL[member.status]}
            </CardTitle>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="space-y-1">
            <CardDescription>Niveau actuel</CardDescription>
            <CardTitle className="text-lg">
              {currentLevel ? `Niveau ${currentLevel.code}` : "Aucun"}
            </CardTitle>
            {member.becameAncestorAt && (
              <p className="text-primary text-xs font-medium">
                🏆 Ancêtre depuis le{" "}
                {member.becameAncestorAt.toLocaleDateString("fr-FR", {
                  dateStyle: "medium",
                })}
              </p>
            )}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="space-y-1">
            <CardDescription>Solde disponible</CardDescription>
            <CardTitle className="text-lg">
              {balance.availableBalance.toLocaleString("fr-FR")} F
            </CardTitle>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Abonnement</CardTitle>
            <CardDescription>
              {subscription.active
                ? `Actif jusqu'au ${subscription.expiresAt!.toLocaleDateString("fr-FR", { dateStyle: "long" })}.`
                : subscription.inGracePeriod
                  ? `Expiré le ${subscription.expiresAt!.toLocaleDateString("fr-FR", { dateStyle: "long" })} — période de grâce : accès maintenu jusqu'au ${subscription.graceEndsAt!.toLocaleDateString("fr-FR", { dateStyle: "long" })}, le membre peut encore renouveler lui-même.`
                  : subscription.frozen
                    ? `Compte désactivé (période de grâce terminée, seul un admin peut le réactiver). Expiré le ${subscription.expiresAt!.toLocaleDateString("fr-FR", { dateStyle: "long" })}.`
                    : "Jamais souscrit."}
            </CardDescription>
          </div>
          {!subscription.active && !creditPreview && (
            <GrantSubscriptionButton userId={member.id} />
          )}
        </CardHeader>
        {creditPreview && (
          <CardContent>
            <ValidateSubscriptionForm
              userId={member.id}
              preview={creditPreview}
            />
          </CardContent>
        )}
        {reminder && (
          <CardContent>
            <SubscriptionReminder
              userId={member.id}
              whatsappUrl={reminder.whatsappUrl}
              lastReminderLabel={reminder.lastLabel}
            />
          </CardContent>
        )}
      </Card>

      {network && (
        <Card>
          <CardHeader>
            <CardTitle>Réseau</CardTitle>
            <CardDescription>
              {network.leftSubtreeCount} à gauche · {network.rightSubtreeCount}{" "}
              à droite · {network.children.length} enfant(s) direct(s)
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-medium">Récompenses</h2>
        {rewards.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">Aucune.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {rewards.map((r) => (
              <li key={r.id} className="flex justify-between">
                <span>{r.reward?.name ?? "Récompense"}</span>
                <span className="text-muted-foreground">
                  {REWARD_STATUS_LABEL[r.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-lg font-medium">Dernières transactions</h2>
        {transactions.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">Aucune.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex justify-between">
                <span>{tx.type}</span>
                <span
                  className={
                    tx.amount >= 0 ? "text-green-600" : "text-destructive"
                  }
                >
                  {tx.amount >= 0 ? "+" : ""}
                  {tx.amount.toLocaleString("fr-FR")} F
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
