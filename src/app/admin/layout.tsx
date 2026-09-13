import { requireAdmin } from "@/services/auth/current-user";
import { MobileSidebarProvider } from "@/components/mobile-sidebar-context";
import { AdminSidebar } from "./admin-sidebar";
import { AdminTopBar } from "./admin-topbar";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { profile } = await requireAdmin();

  return (
    <MobileSidebarProvider>
      <div className="from-primary/15 via-background to-accent/40 min-h-screen bg-linear-to-br p-0 sm:p-8">
        <div className="border-border bg-card mx-auto flex h-screen max-w-7xl overflow-hidden border shadow-2xl sm:h-[calc(100vh-4rem)] sm:rounded-3xl">
          <AdminSidebar adminName={profile.fullName} />
          <div className="flex flex-1 flex-col overflow-y-auto">
            <AdminTopBar adminName={profile.fullName} />
            <main className="flex-1 px-4 py-6 sm:px-8">{children}</main>
          </div>
        </div>
      </div>
    </MobileSidebarProvider>
  );
}
