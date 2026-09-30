import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import {
  GRACE_PERIOD_DAYS,
  type SubscriptionStatus,
} from "@/repositories/subscriptions";

// Matches the email reminder window (services/subscriptions/send-expiry-reminders.ts)
// so the in-app banner and the email start warning at the same moment.
const ALERT_WINDOW_DAYS = 7;

function formatDate(date: Date) {
  return date.toLocaleDateString("fr-FR", { dateStyle: "long" });
}

// Shown on every member page (dashboard/layout.tsx) —
// the visual half of the expiry-alert system, the other half being the
// scheduled email (send-expiry-reminders.ts). Two states: the last
// ALERT_WINDOW_DAYS before expiry, and the grace period right after it
// (access still on, account deactivated once it ends). Renders nothing
// otherwise: never subscribed, comfortably far from expiry, or already
// deactivated (dashboard/layout.tsx shows the blocked screen instead).
// All dates/day counts come pre-computed from getSubscriptionStatus — a
// component's render must stay pure, so "now" is read once at data-fetch
// time, never with Date.now() in here.
export function SubscriptionAlertBanner({
  status,
}: {
  status: SubscriptionStatus;
}) {
  let message: string | null = null;

  if (
    status.inGracePeriod &&
    status.expiresAt &&
    status.graceEndsAt &&
    status.graceDaysLeft != null
  ) {
    const days = status.graceDaysLeft;
    message = `Votre abonnement a expiré le ${formatDate(status.expiresAt)}. ${
      days <= 1 ? "Il vous reste moins d'un jour" : `Il vous reste ${days} jours`
    } pour le renouveler : passé le ${formatDate(status.graceEndsAt)}, votre compte sera désactivé, vous ne toucherez plus de commissions et seul le support pourra le réactiver.`;
  } else if (
    status.active &&
    status.expiresAt &&
    status.daysLeft != null &&
    status.daysLeft <= ALERT_WINDOW_DAYS
  ) {
    message = `${
      status.daysLeft <= 1
        ? "Votre abonnement expire aujourd'hui"
        : `Votre abonnement expire dans ${status.daysLeft} jours`
    } (${formatDate(status.expiresAt)}). Vous disposerez ensuite de ${GRACE_PERIOD_DAYS} jours pour le renouveler avant la désactivation de votre compte.`;
  }

  if (!message) return null;

  return (
    <div className="flex flex-col items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <p className="text-amber-900 dark:text-amber-200">{message}</p>
      </div>
      <Link
        href="/dashboard/subscription"
        className="shrink-0 font-medium text-amber-700 underline underline-offset-2 dark:text-amber-300"
      >
        Renouveler
      </Link>
    </div>
  );
}
