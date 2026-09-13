import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ambassadorProfiles } from "@/db/schema/ambassador-profiles";
import { requireUser } from "@/services/auth/current-user";
import { MobileSidebarProvider } from "@/components/mobile-sidebar-context";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardTopBar } from "./dashboard-topbar";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const { profile } = await requireUser();
  const ambassador = await db.query.ambassadorProfiles.findFirst({
    where: eq(ambassadorProfiles.userId, profile.id),
  });

  return (
    <MobileSidebarProvider>
      <div className="from-primary/15 via-background to-accent/40 min-h-screen bg-linear-to-br p-0 sm:p-8">
        <div className="border-border bg-card mx-auto flex h-screen max-w-7xl overflow-hidden border shadow-2xl sm:h-[calc(100vh-4rem)] sm:rounded-3xl">
          <DashboardSidebar
            memberName={profile.fullName}
            isAdmin={profile.role === "ADMIN"}
            isAmbassador={!!ambassador}
            // Unlike showNav === ACTIVE before this phase: a plain customer
            // (PENDING_PAYMENT, never joined the ambassador program) must
            // still see the nav to reach Cours/Mes achats (section 9/23 of
            // the master prompt) — only a SUSPENDED account is fully
            // blocked, same gate every course page already uses since
            // Phase 11.
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
