import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { SubscriptionStatus } from "@/repositories/subscriptions";

// Matches the email reminder window (services/subscriptions/send-expiry-reminders.ts)
// so the in-app banner and the email start warning at the same moment.
const ALERT_WINDOW_DAYS = 7;

// Shown on the dashboard overview and the subscription page themselves —
// the visual half of the expiry-alert system, the other half being the
// scheduled email (send-expiry-reminders.ts). Renders nothing outside the
// window: never subscribed, already expired (the "no active subscription"
// states elsewhere already cover that), or comfortably far from expiry.
// daysLeft comes pre-computed from getSubscriptionStatus (repositories/
// subscriptions.ts) — a component's render must stay pure, so "now" is read
// once at data-fetch time, never with Date.now() in here.
export function SubscriptionAlertBanner({
  status,
}: {
  status: SubscriptionStatus;
}) {
  if (!status.active || !status.expiresAt || status.daysLeft == null) {
    return null;
  }
  const daysLeft = status.daysLeft;
  if (daysLeft > ALERT_WINDOW_DAYS) return null;

  return (
    <div className="flex flex-col items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <p className="text-amber-900 dark:text-amber-200">
          {daysLeft <= 1
            ? "Votre abonnement expire aujourd'hui."
            : `Votre abonnement expire dans ${daysLeft} jours`}{" "}
          (
          {status.expiresAt.toLocaleDateString("fr-FR", {
            dateStyle: "long",
          })}
          ). L&apos;accès aux formations sera coupé immédiatement, sans période
          de grâce.
        </p>
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
