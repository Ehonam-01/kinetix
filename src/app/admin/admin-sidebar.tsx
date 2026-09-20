"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/config/site";
import { useMobileSidebar } from "@/components/mobile-sidebar-context";
import { LogoutButton } from "@/app/dashboard/logout-button";
import { ADMIN_NAV_ITEMS } from "./nav-items";

export function AdminSidebar({ adminName }: { adminName: string }) {
  const pathname = usePathname();
  const { open, setOpen } = useMobileSidebar();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "bg-sidebar text-sidebar-foreground border-sidebar-border fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col border-r p-4 transition-transform duration-200 ease-out",
          "lg:static lg:z-auto lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-2 py-2">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg text-sm font-bold">
              M
            </div>
            <span className="font-heading text-sm font-semibold">
              {SITE_NAME}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
            className="hover:bg-sidebar-accent flex size-8 items-center justify-center rounded-lg lg:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto">
          {ADMIN_NAV_ITEMS.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-sidebar-border mt-auto space-y-3 border-t pt-4">
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium"
          >
            <ArrowLeft className="size-4" />
            Tableau de bord
          </Link>
          <div className="flex items-center justify-between gap-2 px-3">
            <span className="text-sidebar-foreground/60 truncate text-xs">
              {adminName}
            </span>
            <LogoutButton />
          </div>
        </div>
      </aside>
    </>
  );
}
