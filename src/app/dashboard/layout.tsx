import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ambassadorProfiles } from "@/db/schema/ambassador-profiles";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import { getSubscriptionStatus } from "@/repositories/subscriptions";
import { requireUser } from "@/services/auth/current-user";
import { MobileSidebarProvider } from "@/components/mobile-sidebar-context";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardTopBar } from "./dashboard-topbar";
import { FrozenAccountScreen } from "./frozen-account-screen";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  // DELETED accounts never reach this point — requireUser() itself
  // redirects them straight to /login (services/auth/current-user.ts).
  const { profile } = await requireUser();

  // Subscription status and ambassador lookup don't depend on each other —
  // run them together instead of back-to-back so the shell only waits on
  // whichever round trip is slower, not the sum of both. The ambassador
  // query still fires even when it'll turn out to be unneeded (frozen
  // admin-exempt path below) — cheap enough to trade for the common case.
  const [status, ambassador] = await Promise.all([
    profile.role !== "ADMIN"
      ? getSubscriptionStatus(db, profile.id)
      : Promise.resolve(null),
    db.query.ambassadorProfiles.findFirst({
      where: eq(ambassadorProfiles.userId, profile.id),
    }),
  ]);

  // Payment is mandatory before dashboard access at all (explicit product
  // decision, reverses the earlier free-browsing model) — a member who has
  // never paid (profile.status stays PENDING_PAYMENT until
  // confirm-subscription-payment.ts flips it) sees the same blocking
  // screen a lapsed renewal does, just with different copy
  // (neverSubscribed). Deliberately PENDING_PAYMENT specifically, not
  // "!== ACTIVE": a SUSPENDED account must keep going through its own
  // existing gate below (showNav={false} + every individual page checking
  // status itself) — it has nothing to do with payment, and this screen's
  // copy ("payez votre abonnement") would be actively misleading for an
  // account that already paid and is blocked for an unrelated reason.
  // Admins are exempt, same bypass convention as every other gate here.
  if (profile.role !== "ADMIN" && profile.status === "PENDING_PAYMENT") {
    const price = await getCurrentParameterValue(
      db,
      "subscription.price_in_cfa",
    );
    return (
      <FrozenAccountScreen
        memberName={profile.fullName}
        neverSubscribed
        permanentlyFrozen={false}
        price={price}
        username={profile.username}
      />
    );
  }

  // A lapsed renewal blocks the whole account, replacing every nested route
  // with the same blocked screen (explicit user decision) — admins are
  // exempt, same bypass convention as hasCourseAccess/every other gate.
  if (status?.frozen) {
    const price = await getCurrentParameterValue(
      db,
      "subscription.price_in_cfa",
    );
    return (
      <FrozenAccountScreen
        memberName={profile.fullName}
        permanentlyFrozen={status.permanentlyFrozen}
        price={price}
        username={profile.username}
      />
    );
  }

  return (
    <MobileSidebarProvider>
      <div className="from-primary/15 via-background to-accent/40 min-h-screen bg-linear-to-br p-0 sm:p-8">
        <div className="border-border bg-card mx-auto flex h-screen max-w-7xl overflow-hidden border shadow-2xl sm:h-[calc(100vh-4rem)] sm:rounded-3xl">
          <DashboardSidebar
            memberName={profile.fullName}
            isAdmin={profile.role === "ADMIN"}
            isAmbassador={!!ambassador}
            // PENDING_PAYMENT never reaches this render at all anymore (the
            // gate above intercepts it) — the only two statuses that get
            // here are ACTIVE and SUSPENDED, so this is really just "hide
            // the nav for a suspended account," same gate every course page
            // already uses since Phase 11.
            showNav={profile.status !== "SUSPENDED"}
          />
          <div className="flex flex-1 flex-col overflow-y-auto">
            <DashboardTopBar memberName={profile.fullName} />
            <main className="flex-1 px-4 py-6 sm:px-8">{children}</main>
          </div>
        </div>
      </div>
    </MobileSidebarProvider>
  );
}
